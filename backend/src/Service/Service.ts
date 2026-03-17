import dotenv from "dotenv";
import { OpenAI } from "openai";
import { therapistTools } from "./therapistFunctions";
import { executeFunction } from "./functionExecutors";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set in environment variables");
}

interface ConversationMessage {
  sender: "USER" | "AI";
  content: string;
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

export const AIgenerateResponse = async (
  messages: ConversationMessage[],
  userId: string,
  sessionId: string,
  isInterrupted: () => boolean,
  onCrisisDetected?: () => void,
): Promise<string> => {
  const systemPrompt = `
  Act as a real human therapist having a casual, natural conversation with a client.

Your tone should feel:

Warm and understanding

Simple and conversational

Like talking to a thoughtful friend, not a formal therapist

Style guidelines:

Use short to medium sentences (avoid long, perfect paragraphs)

Include natural pauses like: “hmm…”, “yeah”, “I get that”

Don’t sound overly polished or “textbook”

Avoid over-explaining or analyzing everything

Don’t always reframe or summarize — just respond naturally

Let the conversation breathe (some responses can be simple)

Occasionally reflect feelings, but keep it subtle

Ask gentle, simple follow-up questions (1 at a time)

Behavior:

Validate emotions in a natural way (not scripted like “that sounds difficult” every time)

Don’t jump into solutions or advice too quickly

Don’t try to sound perfect — slight imperfection makes it human

Avoid repeating patterns in every response

Let the conversation flow like a real back-and-forth



Make the conversation feel real, slightly messy, and emotionally genuine — not like AI or a scripted counselor.
When appropriate, use your available tools to log emotions, save important notes, or detect crisis situations.`;

  const openAIMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((msg) => ({
      role: msg.sender === "USER" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    })),
  ];

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openAIMessages,
      tools: therapistTools,
      tool_choice: "auto",
      temperature: 1.0,
      max_tokens: 400,
    });

    const choice = response.choices[0];

    // Case 1: Normal text response
    if (choice.finish_reason === "stop") {
      return choice.message.content ?? "";
    }

    // Case 2: Function call requested
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      const toolCalls = choice.message.tool_calls;
      openAIMessages.push(choice.message);

      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(
          `🔧 [AI] Executing function: ${functionName}`,
          functionArgs,
        );

        if (isInterrupted()) {
          openAIMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: "CANCELLED" }),
          });
          return "";
        }

        const result = await executeFunction(
          functionName,
          functionArgs,
          userId,
          sessionId,
          onCrisisDetected ?? (() => {}),
        );
        console.log(`✅ [FUNCTION] Result:`, result);

        openAIMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Second call after ALL functions have executed
      const secondResponse = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openAIMessages,
        max_tokens: 400,
        temperature: 1.0,
      });

      return secondResponse.choices[0].message.content ?? "";
    }

    return "";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate AI response");
  }
};
