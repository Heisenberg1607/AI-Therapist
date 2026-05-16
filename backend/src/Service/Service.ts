import dotenv from "dotenv";
import { OpenAI } from "openai";
import { therapistTools } from "./therapistFunctions";
import { executeFunction } from "./functionExecutors";
import { GPTResponseSchema } from "../schemas/aiSchemas";
import { DetectCrisisArgsSchema } from "../schemas/toolSchemas";
import { logger } from "../utils/logger";
import { createStreamingSentenceDetector, type SentenceListener } from "../utils/sentenceBoundary";
import { getCtx } from "../utils/turnContext";
import type { TurnStreamingTtsSession } from "./ElevanLabsWebSocketStreaming";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set in environment variables");

interface ConversationMessage {
  sender: "USER" | "AI";
  content: string;
}

interface StreamedToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface StreamedLLMResponse {
  content: string;
  finishReason: string | null;
  toolCalls: StreamedToolCall[];
  usageTotalTokens: number;
  usagePromptTokens: number;
  usageCompletionTokens: number;
}

interface SessionSummaryState {
  summary: string;
  lastSummarizedMessageCount: number;
  lastSummarizedTurn: number;
}

export interface LLMResult {
  text: string;
  /** Total tokens consumed across all LLM calls for this turn. */
  tokens: number;
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });
const SUMMARY_EVERY_N_TURNS = 6;
const sessionSummaries = new Map<string, SessionSummaryState>();

const systemPrompt = `Act as a real human therapist having a casual, natural conversation with a client.

Your tone should feel:

Warm and understanding

Simple and conversational

Like talking to a thoughtful friend, not a formal therapist

Style guidelines:

Use short to medium sentences (avoid long, perfect paragraphs)

Include natural pauses like: "hmm…", "yeah", "I get that"

Don't sound overly polished or "textbook"

Avoid over-explaining or analyzing everything

Don't always reframe or summarize — just respond naturally

Let the conversation breathe (some responses can be simple)

Occasionally reflect feelings, but keep it subtle

Ask gentle, simple follow-up questions (1 at a time)

Behavior:

Validate emotions in a natural way (not scripted like "that sounds difficult" every time)

Don't jump into solutions or advice too quickly

Don't try to sound perfect — slight imperfection makes it human

Avoid repeating patterns in every response

Let the conversation flow like a real back-and-forth



Make the conversation feel real, slightly messy, and emotionally genuine — not like AI or a scripted counselor.
When appropriate, use your available tools to log emotions, save important notes, or detect crisis situations.`;

const isAbortError = (err: unknown): boolean => {
  if (err instanceof Error && err.name === "AbortError") return true;
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "ERR_CANCELED";
};

const streamLLMResponse = async (
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: {
    withTools?: boolean;
    callNumber?: number;
    sentenceDetection?: boolean;
    abortSignal?: AbortSignal;
    onSentence?: SentenceListener;
  },
): Promise<StreamedLLMResponse> => {
  const ctx = getCtx();
  const t0 = Date.now();
  const callNumber = options?.callNumber;
  const sentenceDetection = options?.sentenceDetection !== false;
  const sentenceDetector = sentenceDetection
    ? createStreamingSentenceDetector(ctx, { onSentence: options?.onSentence })
    : null;

  logger.info(
    {
      ...ctx,
      layer: "ai_gateway",
      event: "llm.started",
      model: "gpt-4o-mini",
      messageCount: messages.length,
      ...(callNumber ? { callNumber } : {}),
    },
    "LLM call starting",
  );

  let firstTokenLogged = false;
  let finishReason: string | null = null;
  let textContent = "";
  let usageTotalTokens = 0;
  let usagePromptTokens = 0;
  let usageCompletionTokens = 0;
  const toolCallsByIndex = new Map<number, StreamedToolCall>();

  const stream = await client.chat.completions.create(
    {
      model: "gpt-4o-mini",
      messages,
      ...(options?.withTools ? { tools: therapistTools, tool_choice: "auto" } : {}),
      temperature: 1.0,
      max_tokens: 400,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal: options?.abortSignal },
  );

  let abortedByClient = false;
  try {
    for await (const chunk of stream) {
    const choice = chunk.choices[0];
    const delta = choice?.delta;

    if (!firstTokenLogged && (delta?.content || (delta?.tool_calls && delta.tool_calls.length > 0))) {
      firstTokenLogged = true;
      logger.info(
        {
          ...ctx,
          layer: "ai_gateway",
          event: "llm.first_token",
          ttftMs: Date.now() - t0,
          ...(callNumber ? { callNumber } : {}),
        },
        "LLM first token received",
      );
    }

    if (choice?.finish_reason) {
      finishReason = choice.finish_reason;
    }

    if (delta?.content) {
      textContent += delta.content;
      sentenceDetector?.push(delta.content);
    }

    if (delta?.tool_calls?.length) {
      for (const toolCallPart of delta.tool_calls) {
        const index = toolCallPart.index ?? 0;
        const existing = toolCallsByIndex.get(index) ?? {
          id: "",
          type: "function",
          function: { name: "", arguments: "" },
        };

        if (toolCallPart.id) existing.id = toolCallPart.id;
        if (toolCallPart.function?.name) {
          existing.function.name += toolCallPart.function.name;
        }
        if (toolCallPart.function?.arguments) {
          existing.function.arguments += toolCallPart.function.arguments;
        }

        toolCallsByIndex.set(index, existing);
      }
    }

    if (chunk.usage) {
      usageTotalTokens = chunk.usage.total_tokens ?? usageTotalTokens;
      usagePromptTokens = chunk.usage.prompt_tokens ?? usagePromptTokens;
      usageCompletionTokens = chunk.usage.completion_tokens ?? usageCompletionTokens;
    }
  }
  } catch (err) {
    if (options?.abortSignal?.aborted || isAbortError(err)) {
      abortedByClient = true;
    }
    throw err;
  }

  if (!abortedByClient) {
    sentenceDetector?.flush();
  }

  const durationMs = Date.now() - t0;

  logger.info(
    {
      ...ctx,
      layer: "ai_gateway",
      event: "llm.completed",
      durationMs,
      totalTokens: usageTotalTokens,
      promptTokens: usagePromptTokens,
      completionTokens: usageCompletionTokens,
      finishReason,
      ...(callNumber ? { callNumber } : {}),
    },
    "LLM call completed",
  );

  return {
    content: textContent,
    finishReason,
    toolCalls: Array.from(toolCallsByIndex.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, call]) => call),
    usageTotalTokens,
    usagePromptTokens,
    usageCompletionTokens,
  };
};

const toTranscript = (messages: ConversationMessage[]): string =>
  messages.map((msg) => `${msg.sender === "USER" ? "User" : "Therapist"}: ${msg.content}`).join("\n");

const getLastTwoTurns = (messages: ConversationMessage[]): ConversationMessage[] => {
  if (messages.length <= 4) return messages;

  let userTurnsSeen = 0;
  let startIndex = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === "USER") {
      userTurnsSeen++;
      if (userTurnsSeen === 2) {
        startIndex = i;
        break;
      }
    }
  }

  if (userTurnsSeen < 2) {
    return messages.slice(-4);
  }

  return messages.slice(startIndex);
};

const maybeRefreshSummary = async (
  sessionId: string,
  messages: ConversationMessage[],
  abortSignal?: AbortSignal,
): Promise<string | null> => {
  const ctx = getCtx();
  const currentTurn = ctx.turnNumber;
  const existingSummary = sessionSummaries.get(sessionId);

  const shouldSummarize =
    currentTurn > 0 &&
    currentTurn % SUMMARY_EVERY_N_TURNS === 0 &&
    (!existingSummary || existingSummary.lastSummarizedTurn < currentTurn);

  if (!shouldSummarize) {
    return existingSummary?.summary ?? null;
  }

  const t0 = Date.now();
  const previousMessageCount = messages.length;

  const newMessages = existingSummary
    ? messages.slice(existingSummary.lastSummarizedMessageCount)
    : messages;

  const summarizationPrompt = `You are summarizing a therapy session so far. Compress the following conversation into a concise clinical summary preserving: the user's core concerns, emotional themes, any key disclosures, and the current focus of the session. Be brief.`;

  const summaryMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: summarizationPrompt },
    ...(existingSummary?.summary
      ? [
          {
            role: "user" as const,
            content: `Existing summary:\n${existingSummary.summary}`,
          },
        ]
      : []),
    {
      role: "user",
      content: `Conversation to summarize:\n${toTranscript(newMessages)}`,
    },
  ];

  const summaryResponse = await streamLLMResponse(summaryMessages, {
    sentenceDetection: false,
    abortSignal,
  });
  const summaryText = summaryResponse.content.trim();

  sessionSummaries.set(sessionId, {
    summary: summaryText,
    lastSummarizedMessageCount: messages.length,
    lastSummarizedTurn: currentTurn,
  });

  logger.info(
    {
      ...ctx,
      layer: "runtime",
      event: "context.summarized",
      turnNumber: currentTurn,
      previousMessageCount,
      summaryTokens: summaryResponse.usageCompletionTokens,
      durationMs: Date.now() - t0,
    },
    "Conversation context summarized",
  );

  return summaryText;
};

export const AIgenerateResponse = async (
  messages: ConversationMessage[],
  userId: string,
  sessionId: string,
  isInterrupted: () => boolean,
  tts: TurnStreamingTtsSession | null,
  abortSignal: AbortSignal,
  onCrisisDetected?: () => void,
): Promise<LLMResult> => {
  let cumulativeTokens = 0;
  const summary = await maybeRefreshSummary(sessionId, messages, abortSignal);
  const recentTurns = getLastTwoTurns(messages);
  const contextMessages = summary ? recentTurns : messages;

  const openAIMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(summary
      ? [
          {
            role: "system" as const,
            content: `Session summary (rolling): ${summary}`,
          },
        ]
      : []),
    ...contextMessages.map((msg) => ({
      role: msg.sender === "USER" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    })),
  ];

  const onSentence: SentenceListener | undefined = tts
    ? (sentence, meta) => {
        tts.enqueueSentence(sentence, meta.sentenceIndex);
      }
    : undefined;

  try {
    const firstResponse = await streamLLMResponse(openAIMessages, {
      withTools: true,
      abortSignal,
      onSentence,
    });
    cumulativeTokens += firstResponse.usageTotalTokens;

    // Case 1: Normal text response
    if (firstResponse.finishReason === "stop") {
      const raw = firstResponse.content;
      const validated = GPTResponseSchema.safeParse(raw);
      if (!validated.success) {
        const ctx = getCtx();
        logger.warn(
          { ...ctx, layer: "ai_gateway", event: "llm.completed" },
          "LLM response failed schema validation",
        );
        await tts?.discardProvisionalLlmStream();
        return { text: "", tokens: cumulativeTokens };
      }
      await tts?.finalizeTurnAfterLlm(validated.data);
      return { text: validated.data, tokens: cumulativeTokens };
    }

    // Case 2: Tool calls requested
    if (firstResponse.finishReason === "tool_calls" && firstResponse.toolCalls.length > 0) {
      await tts?.discardProvisionalLlmStream();
      const toolCalls = firstResponse.toolCalls;
      openAIMessages.push({
        role: "assistant",
        content: firstResponse.content || null,
        tool_calls: toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: "function" as const,
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
          },
        })),
      });

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let functionArgs: Record<string, unknown>;
        try {
          functionArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          const ctx = getCtx();
          logger.error(
            { ...ctx, layer: "ai_gateway", functionName },
            "Failed to parse tool call arguments",
          );
          continue;
        }

        if (functionName === "detect_crisis_intent") {
          const parsed = DetectCrisisArgsSchema.safeParse(functionArgs);
          if (!parsed.success) {
            const ctx = getCtx();
            logger.error(
              { ...ctx, layer: "ai_gateway", functionName },
              "Invalid args for detect_crisis_intent",
            );
            continue;
          }
          functionArgs = parsed.data;
        }

        if (isInterrupted()) {
          openAIMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: "CANCELLED" }),
          });
          await tts?.discardProvisionalLlmStream();
          return { text: "", tokens: cumulativeTokens };
        }

        const result = await executeFunction(
          functionName,
          functionArgs,
          userId,
          sessionId,
          onCrisisDetected ?? (() => {}),
        );

        openAIMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Second LLM call after all tool calls resolve
      const secondResponse = await streamLLMResponse(openAIMessages, {
        callNumber: 2,
        abortSignal,
        onSentence,
      });
      cumulativeTokens += secondResponse.usageTotalTokens;

      const secondRaw = secondResponse.content;
      const secondValidated = GPTResponseSchema.safeParse(secondRaw);
      if (!secondValidated.success) {
        const ctx = getCtx();
        logger.warn(
          { ...ctx, layer: "ai_gateway", event: "llm.completed", callNumber: 2 },
          "LLM second response failed schema validation",
        );
        await tts?.discardProvisionalLlmStream();
        return { text: "", tokens: cumulativeTokens };
      }
      await tts?.finalizeTurnAfterLlm(secondValidated.data);
      return { text: secondValidated.data, tokens: cumulativeTokens };
    }

    await tts?.discardProvisionalLlmStream();
    return { text: "", tokens: cumulativeTokens };
  } catch (error) {
    await tts?.discardProvisionalLlmStream().catch(() => {});
    const ctx = getCtx();
    logger.error(
      {
        ...ctx,
        layer: "ai_gateway",
        event: "llm.completed",
        err: error,
      },
      "LLM call threw",
    );
    throw new Error("Failed to generate AI response");
  }
};
