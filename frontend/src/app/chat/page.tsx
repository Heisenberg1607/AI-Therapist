"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneOff, Sparkles, Settings2 } from "lucide-react";
import { VoiceOrb } from "@/app/Components/VoiceOrb";
import { SessionTimer } from "@/app/Components/SessionTimer";
import { CallContextProvider } from "@/app/context/callContext";
import { ProtectedRoute } from "../Components/ProtectedRoute";
import { startSession } from "../lib/api";
import { useAuth } from "../context/authContext";
import CrisisModal from "@/app/UI/UserCallWindow/CrisisModal";
import { PipecatVoice, type PipecatVoiceHandle } from "@/components/PipecatVoice";
import { Onboarding } from "@/components/Onboarding";
import { buildSystemPrompt, type OnboardingAnswers } from "@/lib/buildSystemPrompt";
import { saveSession, type TranscriptTurn } from "@/lib/sessionStorage";
import { completeOnboarding, saveSessionSummary } from "../lib/api";

const ONBOARDING_KEY = "ai_therapist_onboarding";

const ChatPage = () => {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Onboarding gates the chat UI; its answers build the personalized prompt.
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);

  // Voice state — driven by RTVI events from the Pipecat bot via <VoiceCall>.
  const [connected, setConnected] = useState(false);
  const [botSpeaking, setBotSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [botLevel, setBotLevel] = useState(0);
  const [userLevel, setUserLevel] = useState(0);
  const [isCrisis, setIsCrisis] = useState(false);

  const { user, updateUser } = useAuth();
  const router = useRouter();
  const voiceCallRef = useRef<PipecatVoiceHandle | null>(null);

  // Session capture (not displayed) — fed to the post-session dashboard.
  const startedAtRef = useRef<number | null>(null);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const answersRef = useRef<OnboardingAnswers>({});

  // Crisis flag from the bot → show the modal and pause the conversation so the
  // bot stops listening while the user reads the support resources.
  const handleCrisis = useCallback(() => {
    setIsCrisis(true);
    voiceCallRef.current?.pause();
  }, []);

  // "I am safe — continue session" → hide the modal and resume the conversation.
  const dismissCrisis = useCallback(() => {
    setIsCrisis(false);
    voiceCallRef.current?.resume();
  }, []);

  // Already-onboarded users skip onboarding — rebuild the prompt from their
  // stored answers so the gate below passes without asking again.
  useEffect(() => {
    if (user?.onboarded && user.onboardingData && !systemPrompt) {
      answersRef.current = user.onboardingData;
      setSystemPrompt(buildSystemPrompt(user.onboardingData));
    }
  }, [user, systemPrompt]);

  // Orb level: bot's voice while it speaks, user's mic while they speak.
  const orbLevel = useMemo(() => {
    if (botSpeaking) return botLevel;
    if (userSpeaking) return userLevel;
    return 0;
  }, [botSpeaking, botLevel, userSpeaking, userLevel]);

  const aiActive = botSpeaking || botThinking;

  const status = !sessionStarted
    ? "Ready when you are"
    : botThinking
    ? "AI Therapist is reflecting"
    : botSpeaking
    ? "AI Therapist is speaking"
    : userSpeaking
    ? "Listening to you"
    : connected
    ? "Connected · just start talking"
    : "Connecting…";

  const handleStartSession = async () => {
    try {
      setError(null);
      const data = await startSession();
      setSessionId(data.sessionId);
      setSessionStarted(true);
      startedAtRef.current = Date.now();
      transcriptRef.current = [];
      // Pass the fresh sessionId straight to connect(): setSessionId above won't
      // have propagated into <PipecatVoice>'s props by the time connect() reads
      // them, so without this the bot would receive a null sessionId.
      await voiceCallRef.current?.connect({
        sessionId: data.sessionId,
        userId: user?.id ?? null,
        systemPrompt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start session";
      setError(msg);
      setSessionStarted(false);
      setSessionId(null);
    }
  };

  const summarizeTranscript = async (
    transcript: TranscriptTurn[],
  ): Promise<string> => {
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) return "";
      const data = await res.json();
      return typeof data.summary === "string" ? data.summary : "";
    } catch {
      return "";
    }
  };

  const handleEndSession = async () => {
    void voiceCallRef.current?.disconnect();

    const currentSessionId = sessionId;
    const startedAt = startedAtRef.current;
    const duration = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    const transcript = transcriptRef.current;
    const answers = answersRef.current;

    setSessionStarted(false);
    setSessionId(null);
    setConnected(false);
    setBotSpeaking(false);
    setUserSpeaking(false);
    setBotThinking(false);

    const summary = await summarizeTranscript(transcript);
    const topic = answers.reason ?? "";

    // Persist to the DB so the same user can fetch it on future visits.
    // Mood is no longer sent — the server derives start/end mood from the transcript.
    if (currentSessionId) {
      await saveSessionSummary(currentSessionId, {
        summary,
        topic,
        durationSec: duration,
      }).catch(() => {});
    }

    // Local copy (offline fallback for the dashboard). Mood is left blank here;
    // the real start/end mood is derived server-side and read back from the DB.
    saveSession({
      id: currentSessionId ?? String(Date.now()),
      date: new Date().toISOString(),
      duration,
      mood: "",
      topic,
      summary,
      transcript,
    });

    router.push("/dashboard/summary");
  };

  const handleOnboardingComplete = (answers: OnboardingAnswers) => {
    answersRef.current = answers;
    // Persisted so the post-session dashboard can read mood/topic.
    try {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(answers));
    } catch {
      // ignore storage failures
    }
    setSystemPrompt(buildSystemPrompt(answers));
    // Persist the onboarded flag + answers to the DB so we never ask again.
    updateUser({ onboarded: true, onboardingData: answers });
    void completeOnboarding(answers);
  };

  // Show onboarding only for users who haven't onboarded yet. Already-onboarded
  // users have their prompt rebuilt by the effect above, so they skip it.
  if (!user?.onboarded && !systemPrompt) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Display text: a calm prompt only — live captions are disabled.
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const displayText = sessionStarted
    ? connected
      ? `Welcome ${firstName}, I am here to listen. How are you feeling right now?`
      : "Connecting you to your session…"
    : '"A safe, quiet space — whenever you need to talk."';

  return (
    <>
      <PipecatVoice
        ref={voiceCallRef}
        sessionId={sessionId}
        userId={user?.id ?? null}
        systemPrompt={systemPrompt}
        onConnectedChange={setConnected}
        onBotSpeaking={setBotSpeaking}
        onUserSpeaking={setUserSpeaking}
        onBotThinking={setBotThinking}
        onBotAudioLevel={setBotLevel}
        onUserAudioLevel={setUserLevel}
        onUserTranscript={(text, final) => {
          // Captured for the post-session summary; not displayed (captions off).
          if (final && text.trim()) {
            transcriptRef.current.push({
              role: "user",
              content: text,
              timestamp: new Date().toISOString(),
            });
          }
        }}
        onBotTranscript={(text) => {
          if (text.trim()) {
            transcriptRef.current.push({
              role: "assistant",
              content: text,
              timestamp: new Date().toISOString(),
            });
          }
        }}
        onCrisis={handleCrisis}
      />

      {isCrisis && <CrisisModal onDismiss={dismissCrisis} />}

      <div
        className="relative min-h-screen text-white overflow-hidden"
        style={{ background: "hsl(240, 20%, 4%)" }}
      >
        {/* Ambient nebula background */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-40 -left-40 w-[800px] h-[800px] rounded-full blur-[120px] opacity-60"
            style={{
              background:
                "radial-gradient(circle, hsla(72, 100%, 70%, 0.08), transparent 60%)",
              animation: "drift 18s ease-in-out infinite",
            }}
          />
          <div
            className="absolute -bottom-40 -right-20 w-[600px] h-[600px] rounded-full blur-[100px] opacity-70"
            style={{
              background:
                "radial-gradient(circle, hsla(220, 80%, 60%, 0.25), transparent 60%)",
              animation: "drift 24s ease-in-out infinite reverse",
            }}
          />
          {/* Star particle grid */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, hsla(72, 100%, 70%, 0.25) 1px, transparent 0)",
              backgroundSize: "44px 44px",
              maskImage:
                "radial-gradient(circle at center, black, transparent 80%)",
              WebkitMaskImage:
                "radial-gradient(circle at center, black, transparent 80%)",
            }}
          />
        </div>

        {/* Header — sits below fixed navbar (navbar is ~60px tall) */}
        <header className="relative z-10 flex items-center justify-between px-8 md:px-12 pt-20 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                sessionStarted
                  ? "bg-starlight shadow-[0_0_12px_hsla(72,100%,70%,0.7)] animate-pulse"
                  : "bg-white/20"
              }`}
            />
            <span className="text-[10px] uppercase tracking-[0.4em] text-starlight/80 font-medium">
              AI Therapist Session · {sessionStarted ? "Active" : "Standby"}
            </span>
          </div>

          <div className="hidden sm:flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              Presence
            </span>
            <span className="text-xl italic text-white/90" style={{ fontFamily: "Georgia, serif" }}>
              AI Therapist
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              Duration
            </span>
            <span className="font-medium text-white/90">
              <SessionTimer active={sessionStarted} />
            </span>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="relative z-10 mx-auto max-w-md px-8 mb-2">
            <div className="bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Main — orb + text */}
        <main
          className="relative z-10 flex flex-col items-center justify-center px-6"
          style={{ minHeight: "calc(100vh - 280px)" }}
        >
          <VoiceOrb level={orbLevel} active={sessionStarted} size={280} />

          <div
            className="mt-12 text-center max-w-xl px-4"
            style={{ animation: "fade-in 0.5s ease-out" }}
          >
            <p
              className="text-2xl md:text-3xl text-white/90 leading-relaxed italic"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {displayText}
            </p>
            <p className="mt-5 text-[10px] uppercase tracking-[0.4em] text-starlight/60 font-semibold">
              {status}
            </p>
          </div>
        </main>

        {/* Controls */}
        <footer className="fixed bottom-10 inset-x-0 z-20 flex justify-center px-4">
          {!sessionStarted ? (
            <button
              onClick={handleStartSession}
              className="group relative px-10 h-16 rounded-full font-semibold text-sm uppercase tracking-[0.25em] hover:scale-[1.02] active:scale-95 transition-transform flex items-center gap-3 text-black"
              style={{
                background: "hsl(72, 100%, 70%)",
                boxShadow: "0 0 40px hsla(72, 100%, 70%, 0.4)",
              }}
            >
              <Sparkles className="w-4 h-4" />
              Begin Session
            </button>
          ) : (
            <div
              className="flex items-center gap-6 md:gap-10 px-8 py-4 rounded-full border border-white/10 backdrop-blur-2xl shadow-2xl"
              style={{
                background: "rgba(255,255,255,0.05)",
                animation: "scale-in 0.3s ease-out",
              }}
            >
              {/* End session */}
              <button
                onClick={handleEndSession}
                className="group relative"
                aria-label="End session"
              >
                <div className="absolute inset-0 bg-red-600/30 blur-xl group-hover:bg-red-600/50 transition-all rounded-full" />
                <div className="relative w-16 h-16 rounded-full bg-red-600/15 border border-red-600/50 flex items-center justify-center hover:bg-red-600 hover:border-red-600 transition-all duration-300">
                  <PhoneOff className="w-6 h-6 text-red-500 group-hover:text-white transition-colors" />
                </div>
                <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.25em] text-red-500/70 whitespace-nowrap">
                  End
                </span>
              </button>

              {/* Settings (placeholder) */}
              <button className="group flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:border-starlight/40 hover:bg-starlight/5 transition-all text-white/70">
                  <Settings2 className="w-5 h-5" />
                </div>
                <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 group-hover:text-starlight transition-colors">
                  Settings
                </span>
              </button>
            </div>
          )}
        </footer>

        {/* Side metrics panel — desktop only */}
        {sessionStarted && (
          <aside className="hidden lg:flex fixed right-12 top-1/2 -translate-y-1/2 flex-col gap-10 items-end opacity-30 hover:opacity-100 transition-opacity duration-700 z-10">
            {[
              {
                k: "State",
                v: botThinking
                  ? "Reflecting"
                  : userSpeaking
                  ? "Listening"
                  : aiActive
                  ? "Speaking"
                  : "Idle",
              },
              { k: "Tone", v: "Calm" },
              { k: "Flow", v: "Coherent" },
            ].map((m) => (
              <div key={m.k} className="flex flex-col items-end gap-1">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                  {m.k}
                </span>
                <span className="text-xs text-starlight">{m.v}</span>
              </div>
            ))}
          </aside>
        )}

        {/* Connection status dot — bottom-left when connected */}
        {sessionStarted && connected && (
          <div className="fixed bottom-12 left-8 z-10 flex items-center gap-2 opacity-50">
            <div className="w-1.5 h-1.5 rounded-full bg-starlight animate-pulse" />
            <span className="text-[9px] uppercase tracking-[0.25em] text-white/40">
              Live
            </span>
          </div>
        )}

        {/* User name — bottom-left context */}
        {user && (
          <div className="fixed top-20 left-8 z-10 opacity-30 hover:opacity-70 transition-opacity hidden lg:block">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              {user.name || user.email}
            </span>
          </div>
        )}
      </div>
    </>
  );
};

const Page = () => (
  <ProtectedRoute>
    <CallContextProvider>
      <ChatPage />
    </CallContextProvider>
  </ProtectedRoute>
);

export default Page;
