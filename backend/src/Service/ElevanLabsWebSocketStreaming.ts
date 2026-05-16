import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";
import WebSocket from "ws";
import { ElevenLabsInputSchema } from "../schemas/aiSchemas";
import { logger } from "../utils/logger";
import { getCtx } from "../utils/turnContext";

dotenv.config();

let elevenlabs: ElevenLabsClient | null = null;

const MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";

const getElevenLabsClient = () => {
  if (!elevenlabs) {
    const apiKey = process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY not found in environment variables");
    elevenlabs = new ElevenLabsClient({ apiKey });
  }
  return elevenlabs;
};

const wsSend = (ws: WebSocket, payload: string): Promise<void> =>
  new Promise((resolve, reject) => {
    ws.send(payload, (err) => (err ? reject(err) : resolve()));
  });

const ensureTrailingSpace = (text: string): string => (/\s$/.test(text) ? text : `${text} `);

export type TurnStreamingTtsHandlers = {
  onChunk: (chunk: Uint8Array) => void;
  onComplete: (spokenText: string) => void;
  onError: (error: Error) => void;
  isInterrupted: () => boolean;
};

export interface TurnStreamingTtsSession {
  enqueueSentence: (sentence: string, sentenceIndex: number) => void;
  discardProvisionalLlmStream: () => Promise<void>;
  finalizeTurnAfterLlm: (fullSpokenText: string) => Promise<void>;
  /** Hard-stop playback and close the ElevenLabs socket (barge-in / turn cancel). */
  abortTurn: () => void;
}

/**
 * One ElevenLabs `stream-input` WebSocket per turn. Sentences are sent on the same
 * connection with `flush: true`; stream ends with `{"text":""}`.
 */
export const createTurnStreamingTtsSession = (handlers: TurnStreamingTtsHandlers): TurnStreamingTtsSession => {
  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "ADd2WEtjmwokqUr0Y5Ad";
  const sessionStartedAt = Date.now();
  let firstElWsOpenedAt: number | null = null;

  let ws: WebSocket | null = null;
  let sendChain: Promise<void> = Promise.resolve();
  let chunkCount = 0;
  let firstChunkLogged = false;
  let ttfcRefMs: number | null = null;
  let resolveIsFinal: (() => void) | null = null;
  let isFinalPromise: Promise<void> | null = null;
  let sawAudioThisConnection = false;

  const rebuildIsFinalPromise = () => {
    isFinalPromise = new Promise<void>((resolve) => {
      resolveIsFinal = resolve;
    });
  };

  const killSocket = () => {
    if (ws) {
      try {
        ws.removeAllListeners();
        ws.close();
      } catch {
        /* ignore */
      }
      ws = null;
    }
    resolveIsFinal?.();
    resolveIsFinal = null;
  };

  const onMessage = (raw: WebSocket.RawData) => {
    if (handlers.isInterrupted()) return;

    const str = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(str) as Record<string, unknown>;
    } catch {
      return;
    }

    if (typeof msg.error === "string") {
      logger.error(
        { ...getCtx(), layer: "ai_gateway", event: "tts.error", err: msg.error },
        "ElevenLabs WebSocket error payload",
      );
      handlers.onError(new Error(msg.error));
      killSocket();
      return;
    }

    if (typeof msg.audio === "string") {
      sawAudioThisConnection = true;
      chunkCount++;
      const buf = Buffer.from(msg.audio, "base64");
      const ctx = getCtx();
      if (!firstChunkLogged) {
        firstChunkLogged = true;
        const ref = ttfcRefMs ?? sessionStartedAt;
        logger.info(
          {
            ...ctx,
            layer: "ai_gateway",
            event: "tts.first_chunk",
            ttfcMs: Date.now() - ref,
          },
          "TTS first chunk received",
        );
      }
      if (!handlers.isInterrupted()) {
        handlers.onChunk(new Uint8Array(buf));
      }
    }

    if (msg.isFinal === true) {
      resolveIsFinal?.();
      resolveIsFinal = null;
    }
  };

  const openWebSocket = async (): Promise<WebSocket> => {
    if (!apiKey) {
      throw new Error("ELEVEN_LABS_API_KEY not found in environment variables");
    }
    const uri = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input?model_id=${encodeURIComponent(MODEL_ID)}&output_format=${encodeURIComponent(OUTPUT_FORMAT)}`;

    const socket = await new Promise<WebSocket>((resolve, reject) => {
      const w = new WebSocket(uri, { headers: { "xi-api-key": apiKey } });
      w.once("open", () => resolve(w));
      w.once("error", reject);
    });

    socket.on("message", onMessage);
    socket.on("close", () => {
      resolveIsFinal?.();
      resolveIsFinal = null;
    });

    await wsSend(
      socket,
      JSON.stringify({
        text: " ",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
      }),
    );

    rebuildIsFinalPromise();
    firstChunkLogged = false;
    ttfcRefMs = null;
    sawAudioThisConnection = false;
    if (firstElWsOpenedAt === null) {
      firstElWsOpenedAt = Date.now();
    }
    return socket;
  };

  const ensureOpen = async (): Promise<WebSocket> => {
    if (handlers.isInterrupted()) {
      throw new Error("TTS interrupted");
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      return ws;
    }
    ws = await openWebSocket();
    return ws;
  };

  const enqueueSentence = (sentence: string, sentenceIndex: number): void => {
    if (handlers.isInterrupted()) return;

    const validated = ElevenLabsInputSchema.safeParse(sentence);
    if (!validated.success) {
      logger.error(
        { ...getCtx(), layer: "ai_gateway", event: "tts.started", valid: false, sentenceIndex },
        "TTS input validation failed",
      );
      handlers.onError(new Error(`Invalid TTS input: ${validated.error.message}`));
      killSocket();
      return;
    }

    sendChain = sendChain.then(async () => {
      if (handlers.isInterrupted()) return;
      try {
        const active = await ensureOpen();
        if (handlers.isInterrupted()) return;

        const ctx = getCtx();
        logger.info(
          { ...ctx, layer: "ai_gateway", event: "tts.started", sentenceIndex },
          "TTS stream starting",
        );

        if (sentenceIndex === 1) {
          ttfcRefMs = Date.now();
        }

        const text = ensureTrailingSpace(validated.data);
        await wsSend(active, JSON.stringify({ text, flush: true }));
      } catch (e) {
        if (handlers.isInterrupted()) return;
        const err = e instanceof Error ? e : new Error(String(e));
        logger.error(
          { ...getCtx(), layer: "ai_gateway", event: "tts.error", err: err.message },
          "TTS sentence send error",
        );
        handlers.onError(err);
        killSocket();
      }
    });
  };

  const discardProvisionalLlmStream = async (): Promise<void> => {
    await sendChain.catch(() => {});
    sendChain = Promise.resolve();
    killSocket();
  };

  const abortTurn = (): void => {
    void sendChain.catch(() => {});
    sendChain = Promise.resolve();
    killSocket();
  };

  const finalizeTurnAfterLlm = async (fullSpokenText: string): Promise<void> => {
    if (handlers.isInterrupted()) {
      abortTurn();
      return;
    }

    await sendChain.catch(() => {});

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (handlers.isInterrupted()) {
      abortTurn();
      return;
    }

    rebuildIsFinalPromise();
    const waitFinal = isFinalPromise!;

    try {
      await wsSend(ws, JSON.stringify({ text: "" }));
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      logger.error({ ...getCtx(), layer: "ai_gateway", event: "tts.error", err }, "TTS end-marker send failed");
      handlers.onError(err);
      killSocket();
      return;
    }

    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("TTS stream-end timeout")), 120_000),
    );

    try {
      await Promise.race([waitFinal, timeout]);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      logger.error({ ...getCtx(), layer: "ai_gateway", event: "tts.error", err: err.message }, "TTS wait for final failed");
      handlers.onError(err);
      killSocket();
      return;
    }

    if (handlers.isInterrupted()) {
      abortTurn();
      return;
    }

    logger.info(
      {
        ...getCtx(),
        layer: "ai_gateway",
        event: "tts.completed",
        durationMs: Date.now() - (firstElWsOpenedAt ?? sessionStartedAt),
        chunkCount,
      },
      "TTS stream complete",
    );

    if (sawAudioThisConnection) {
      handlers.onComplete(fullSpokenText);
    }

    killSocket();
  };

  return {
    enqueueSentence,
    discardProvisionalLlmStream,
    finalizeTurnAfterLlm,
    abortTurn,
  };
};

/** Legacy one-shot HTTP streaming (full text). Kept for non–real-time use cases. */
export const streamSpeechWithElevenLabs = async (
  text: string,
  onChunk: (chunk: Uint8Array) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
) => {
  const inputValidation = ElevenLabsInputSchema.safeParse(text);
  if (!inputValidation.success) {
    logger.error(
      { ...getCtx(), layer: "ai_gateway", event: "tts.started", valid: false },
      "TTS input validation failed",
    );
    onError(new Error(`Invalid TTS input: ${inputValidation.error.message}`));
    return;
  }

  const ctx = getCtx();
  const t0 = Date.now();

  logger.info(
    { ...ctx, layer: "ai_gateway", event: "tts.started", sentenceIndex: 1 },
    "TTS stream starting",
  );

  try {
    const client = getElevenLabsClient();
    const webStream = await client.textToSpeech.stream(
      process.env.ELEVENLABS_VOICE_ID || "ADd2WEtjmwokqUr0Y5Ad",
      {
        text,
        modelId: MODEL_ID,
        outputFormat: OUTPUT_FORMAT,
      },
    );

    const reader = webStream.getReader();
    let chunkCount = 0;
    let firstChunkLogged = false;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        logger.info(
          {
            ...ctx,
            layer: "ai_gateway",
            event: "tts.completed",
            durationMs: Date.now() - t0,
            chunkCount,
          },
          "TTS stream complete",
        );
        onComplete();
        break;
      }

      if (value) {
        chunkCount++;

        if (!firstChunkLogged) {
          firstChunkLogged = true;
          logger.info(
            {
              ...ctx,
              layer: "ai_gateway",
              event: "tts.first_chunk",
              ttfcMs: Date.now() - t0,
            },
            "TTS first chunk received",
          );
        }

        onChunk(value);
      }
    }
  } catch (error) {
    logger.error(
      {
        ...ctx,
        layer: "ai_gateway",
        event: "tts.error",
        durationMs: Date.now() - t0,
        err: error,
      },
      "TTS stream error",
    );
    onError(error as Error);
  }
};
