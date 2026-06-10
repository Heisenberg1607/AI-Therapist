"use client";

import {
  type ComponentProps,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import { PipecatClientAudio, PipecatClientProvider } from "@pipecat-ai/client-react";
import { DailyTransport } from "@pipecat-ai/daily-transport";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";

const BASE_URL =
  process.env.NEXT_PUBLIC_PIPECAT_BOT_URL ?? "http://localhost:7860";
const BOT_KEY =
  process.env.NEXT_PUBLIC_PIPECAT_BOT_KEY ??
  process.env.NEXT_PUBLIC_PIPECAT_PUBLIC_KEY;

// "smallwebrtc" → local bot (no Daily account needed)
// "daily"       → Pipecat Cloud (production)
const TRANSPORT = process.env.NEXT_PUBLIC_PIPECAT_TRANSPORT ?? "daily";

function resolveBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function resolveStartEndpoint(baseUrl: string): string {
  const trimmed = resolveBaseUrl(baseUrl);
  return trimmed.endsWith("/start") ? trimmed : `${trimmed}/start`;
}

/** Session identity passed to connect(). Lets the caller hand in freshly
 *  created values (e.g. a sessionId from startSession()) without waiting for a
 *  React re-render to propagate them into props. */
export type ConnectOverrides = {
  sessionId?: string | null;
  userId?: string | null;
  systemPrompt?: string | null;
};

export type PipecatVoiceHandle = {
  connect: (overrides?: ConnectOverrides) => Promise<void>;
  disconnect: () => Promise<void>;
  /** Pause the conversation by muting the mic (e.g. while the crisis modal is up). */
  pause: () => void;
  /** Resume the conversation by re-enabling the mic. */
  resume: () => void;
};

export type PipecatVoiceProps = {
  /** DB session id from startSession(); forwarded to the bot via requestData.body. */
  sessionId?: string | null;
  /** Authenticated user id; forwarded to the bot via requestData.body. */
  userId?: string | null;
  /** Personalized system prompt from onboarding; forwarded via requestData.body. */
  systemPrompt?: string | null;
  /** Transport connected/ready ↔ disconnected. */
  onConnectedChange?: (connected: boolean) => void;
  /** Bot started/stopped speaking (TTS playback). */
  onBotSpeaking?: (speaking: boolean) => void;
  /** User started/stopped speaking (VAD). */
  onUserSpeaking?: (speaking: boolean) => void;
  /** Bot LLM inference in flight ("reflecting"). */
  onBotThinking?: (thinking: boolean) => void;
  /** Bot output audio level, 0..1. */
  onBotAudioLevel?: (level: number) => void;
  /** Local mic audio level, 0..1. */
  onUserAudioLevel?: (level: number) => void;
  /** Final/partial user transcription. */
  onUserTranscript?: (text: string, final: boolean) => void;
  /** Streamed bot transcription. */
  onBotTranscript?: (text: string) => void;
  /** Crisis signalled by the bot via a server message. */
  onCrisis?: () => void;
};

type CallbackBag = PipecatVoiceProps;

/**
 * PipecatVoice — logic-only voice connection using PipecatClient +
 * DailyTransport. Starts the agent via Pipecat Cloud's public /start endpoint,
 * then joins the returned Daily room. Owns the client, exposes
 * connect()/disconnect() via ref, surfaces RTVI events through callback props,
 * and renders PipecatClientAudio for playback. Renders no visible UI.
 */
export const PipecatVoice = forwardRef<PipecatVoiceHandle, PipecatVoiceProps>(
  (props, ref) => {
    // Always-fresh view of props so the client's construction-time callbacks
    // (created once) read the latest handlers/session data.
    const bag = useRef<CallbackBag>(props);
    bag.current = props;

    const client = useMemo(() => {
      const cb = () => bag.current;
      return new PipecatClient({
        transport:
          TRANSPORT === "smallwebrtc"
            ? new SmallWebRTCTransport()
            : new DailyTransport({ bufferLocalAudioUntilBotReady: true }),
        enableMic: true,
        enableCam: false,
        callbacks: {
          onConnected: () => cb().onConnectedChange?.(true),
          onDisconnected: () => cb().onConnectedChange?.(false),
          onBotStartedSpeaking: () => cb().onBotSpeaking?.(true),
          onBotStoppedSpeaking: () => cb().onBotSpeaking?.(false),
          onUserStartedSpeaking: () => cb().onUserSpeaking?.(true),
          onUserStoppedSpeaking: () => cb().onUserSpeaking?.(false),
          onBotLlmStarted: () => cb().onBotThinking?.(true),
          onBotLlmStopped: () => cb().onBotThinking?.(false),
          onRemoteAudioLevel: (level) => cb().onBotAudioLevel?.(level),
          onLocalAudioLevel: (level) => cb().onUserAudioLevel?.(level),
          onUserTranscript: (data) =>
            cb().onUserTranscript?.(data.text, data.final),
          onBotTranscript: (data) => cb().onBotTranscript?.(data.text),
          // The bot sends a server-message { event: "crisis" } to raise the modal.
          onServerMessage: (data) => {
            const payload = data as { event?: string; type?: string } | null;
            if (payload?.event === "crisis" || payload?.type === "crisis") {
              cb().onCrisis?.();
            }
          },
        },
      });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        connect: async (overrides?: ConnectOverrides) => {
          const sessionBody = {
            sessionId: overrides?.sessionId ?? bag.current.sessionId ?? null,
            userId: overrides?.userId ?? bag.current.userId ?? null,
            systemPrompt:
              overrides?.systemPrompt ?? bag.current.systemPrompt ?? null,
          };

          if (TRANSPORT === "smallwebrtc") {
            // Local SmallWebRTC: POST /start to register the session body with
            // Pipecat, then connect via the returned sessions proxy URL. This
            // threads our sessionId through to runner_args.body in bot.py.
            const res = await fetch(resolveStartEndpoint(BASE_URL), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transport: "webrtc", body: sessionBody }),
            });

            if (!res.ok) {
              const detail = await res.text().catch(() => "");
              throw new Error(
                `Failed to start bot (${res.status} ${res.statusText}) ${detail}`,
              );
            }

            const payload = (await res.json()) as { sessionId?: string };
            if (!payload.sessionId) {
              throw new Error("Start endpoint did not return a sessionId");
            }

            const webrtcUrl = `${resolveBaseUrl(BASE_URL)}/sessions/${payload.sessionId}/api/offer`;
            await client.connect({ webrtcUrl } as Parameters<typeof client.connect>[0]);
          } else {
            // Pipecat Cloud / Daily: requires a Bearer public key and
            // createDailyRoom: true. Session identity is nested in `body` so
            // it arrives at the bot as runner_args.body.
            if (!BOT_KEY) {
              throw new Error(
                "Missing NEXT_PUBLIC_PIPECAT_BOT_KEY (or NEXT_PUBLIC_PIPECAT_PUBLIC_KEY) in frontend env",
              );
            }

            const res = await fetch(resolveStartEndpoint(BASE_URL), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${BOT_KEY}`,
              },
              body: JSON.stringify({ createDailyRoom: true, body: sessionBody }),
            });

            if (!res.ok) {
              const detail = await res.text().catch(() => "");
              throw new Error(
                `Failed to start bot (${res.status} ${res.statusText}) ${detail}`,
              );
            }

            const payload = (await res.json()) as {
              dailyRoom?: string;
              dailyToken?: string;
              roomUrl?: string;
              token?: string;
              url?: string;
            };

            const dailyRoom =
              payload.dailyRoom ?? payload.roomUrl ?? payload.url;
            const dailyToken = payload.dailyToken ?? payload.token;

            if (!dailyRoom) {
              throw new Error("Start endpoint did not return a Daily room URL");
            }

            await client.connect({ url: dailyRoom, token: dailyToken });
          }
        },
        disconnect: async () => {
          await client.disconnect();
        },
        // Muting the local mic stops new user turns from reaching the bot, so
        // the conversation effectively pauses; re-enabling lets it continue.
        pause: () => {
          client.enableMic(false);
        },
        resume: () => {
          client.enableMic(true);
        },
      }),
      [client],
    );

    // Tear down the transport if the component unmounts mid-call.
    useEffect(() => {
      return () => {
        void client.disconnect().catch(() => {});
      };
    }, [client]);

    // client-react@1.6.0's bundled types reference a bare "client-js" module,
    // so its expected client type doesn't unify with client-js@1.10's
    // PipecatClient. Same package at runtime — cast through the prop's type.
    type ProviderClient = ComponentProps<typeof PipecatClientProvider>["client"];

    return (
      <PipecatClientProvider client={client as unknown as ProviderClient}>
        <PipecatClientAudio />
      </PipecatClientProvider>
    );
  },
);

PipecatVoice.displayName = "PipecatVoice";
