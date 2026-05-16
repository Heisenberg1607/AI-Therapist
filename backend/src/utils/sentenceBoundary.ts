import { logger } from "./logger";
import type { TurnContext } from "./turnContext";

const isSentencePunct = (c: string): boolean => c === "." || c === "!" || c === "?";

const isBoundaryAt = (buffer: string, punctIdx: number, endOfStream: boolean): boolean => {
  const next = buffer[punctIdx + 1];
  if (next === undefined) return endOfStream;
  return /\s/.test(next);
};

/**
 * Returns the index of the closing punctuation for the first complete sentence
 * in `buffer`, or -1 if none yet. A boundary is `.` `!` or `?` followed by
 * whitespace, or punctuation at the end of the buffer when `endOfStream` is true.
 */
export const findFirstSentenceEnd = (buffer: string, endOfStream: boolean): number => {
  for (let i = 0; i < buffer.length; i++) {
    if (isSentencePunct(buffer[i]) && isBoundaryAt(buffer, i, endOfStream)) {
      return i;
    }
  }
  return -1;
};

const consumeLeadingWhitespace = (s: string): string => {
  let i = 0;
  while (i < s.length && /\s/.test(s[i])) i++;
  return s.slice(i);
};

export type SentenceListener = (sentence: string, meta: { sentenceIndex: number; charCount: number }) => void;

export type StreamingSentenceDetector = {
  /** Append streamed text; emits metadata logs when a sentence completes. */
  push: (chunk: string) => void;
  /** Call once when the LLM stream ends; flushes any non-empty remainder. */
  flush: () => void;
};

/**
 * Buffers streamed characters, detects sentence boundaries, and logs metadata only.
 * Optional `onSentence` receives the same trimmed sentence used for detection (for TTS, etc.).
 */
export const createStreamingSentenceDetector = (
  ctx: TurnContext,
  options?: { onSentence?: SentenceListener },
): StreamingSentenceDetector => {
  let buffer = "";
  let sentenceIndex = 0;

  const emitSentence = (sentence: string): void => {
    sentenceIndex += 1;
    const charCount = sentence.length;
    logger.info(
      {
        sessionId: ctx.sessionId,
        turnId: ctx.turnId,
        turnNumber: ctx.turnNumber,
        layer: "ai_gateway",
        event: "sentence.detected",
        sentenceIndex,
        charCount,
      },
      "Sentence boundary detected",
    );
    options?.onSentence?.(sentence, { sentenceIndex, charCount });
  };

  const extractAllWhileStreaming = (): void => {
    let end = findFirstSentenceEnd(buffer, false);
    while (end !== -1) {
      const sentence = buffer.slice(0, end + 1).trim();
      buffer = consumeLeadingWhitespace(buffer.slice(end + 1));
      if (sentence.length > 0) {
        emitSentence(sentence);
      }
      end = findFirstSentenceEnd(buffer, false);
    }
  };

  return {
    push(chunk: string) {
      if (!chunk) return;
      buffer += chunk;
      extractAllWhileStreaming();
    },
    flush() {
      let end = findFirstSentenceEnd(buffer, true);
      while (end !== -1) {
        const sentence = buffer.slice(0, end + 1).trim();
        buffer = consumeLeadingWhitespace(buffer.slice(end + 1));
        if (sentence.length > 0) {
          emitSentence(sentence);
        }
        end = findFirstSentenceEnd(buffer, true);
      }
      const rest = buffer.trim();
      buffer = "";
      if (rest.length > 0) {
        emitSentence(rest);
      }
    },
  };
};
