"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { RTVIClient } from "realtime-ai";
import { RTVIClientAudio, RTVIClientProvider } from "realtime-ai-react";
import { DailyTransport } from "@daily-co/realtime-ai-daily";

export type VoiceCallHandle = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

export type VoiceCallProps = {
  /** DB session id from startSession(); forwarded to the bot via requestData.body. */
  sessionId?: string | null;
  /** Authenticated user id; forwarded to the bot via requestData.body. */
  userId?: string | null;
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
  /** Crisis signalled by the bot via a server-message. */
  onCrisis?: () => void;
};

type CallbackBag = Omit<VoiceCallProps, "sessionId" | "userId"> & {
  sessionId?: string | null;
  userId?: string | null;
};

/**
 * VoiceCall — logic-only voice connection using RTVIClient + DailyTransport.
 *
 * Owns the RTVI client, exposes connect()/disconnect() via ref, surfaces RTVI
 * events through callback props, and renders RTVIClientAudio for playback.
 * Renders no visible UI.
 */
export const VoiceCall = forwardRef<VoiceCallHandle, VoiceCallProps>(
  (props, ref) => {
    // Always-fresh view of props so the client's construction-time callbacks
    // (created once) read the latest handlers/session data.
    const bag = useRef<CallbackBag>(props);
    bag.current = props;

    const client = useMemo(() => {
      const cb = () => bag.current;
      return new RTVIClient({
        transport: new DailyTransport(),
        enableMic: true,
        enableCam: false,
        params: {
          baseUrl: "http://localhost:7860",
          endpoints: {
            connect: "/start",
          },
        },
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
          // Unrecognized message types (e.g. the bot's "server-message") land
          // here. The bot sends { event: "crisis" } to raise the crisis modal.
          onGenericMessage: (data) => {
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
        connect: async () => {
          // requestData is read at connect() time — attach the latest session
          // identity so the bot can persist/evaluate/attribute this call.
          client.params.requestData = {
            ...client.params.requestData,
            createDailyRoom: true,
            body: {
              sessionId: bag.current.sessionId ?? null,
              userId: bag.current.userId ?? null,
            },
          };
          await client.connect();
        },
        disconnect: async () => {
          await client.disconnect();
        },
      }),
      [client],
    );

    // Ensure we tear down the transport if the component unmounts mid-call.
    useEffect(() => {
      return () => {
        void client.disconnect().catch(() => {});
      };
    }, [client]);

    return (
      <RTVIClientProvider client={client}>
        <RTVIClientAudio />
      </RTVIClientProvider>
    );
  },
);

VoiceCall.displayName = "VoiceCall";
