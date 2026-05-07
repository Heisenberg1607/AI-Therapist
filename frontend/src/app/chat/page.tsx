"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Sparkles, Settings2 } from "lucide-react";
import { VoiceOrb } from "@/app/Components/VoiceOrb";
import { SessionTimer } from "@/app/Components/SessionTimer";
import { useMicLevel } from "@/app/hooks/useMicLevel";
import { useUserCallWindow } from "@/app/hooks/useUserCallWindow";
import { useCallContext } from "@/app/context/callContext";
import { CallContextProvider } from "@/app/context/callContext";
import { ProtectedRoute } from "../Components/ProtectedRoute";
import { startSession } from "../lib/api";
import { useAuth } from "../context/authContext";
import CrisisModal from "@/app/UI/UserCallWindow/CrisisModal";

const ChatPage = () => {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiLevel, setAiLevel] = useState(0);
  const [isWelcomePlaying, setIsWelcomePlaying] = useState(false);

  const { user } = useAuth();
  const { text, isProcessing, isAudioPlaying } = useCallContext();
  const { handleOnRecord, isRecording, isConnected, isCrisis, dismissCrisis } =
    useUserCallWindow({ sessionId });

  const { level: micLevel } = useMicLevel(isRecording);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Welcome audio on session start — track playback for orb animation
  useEffect(() => {
    if (sessionStarted) {
      if (!audioRef.current) {
        const audio = new Audio("/welcomeMessage.mp3");
        audio.onplay = () => setIsWelcomePlaying(true);
        audio.onended = () => setIsWelcomePlaying(false);
        audio.onpause = () => setIsWelcomePlaying(false);
        audioRef.current = audio;
        audio.play().catch(console.error);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      setIsWelcomePlaying(false);
    }
  }, [sessionStarted]);

  // Animate orb whenever AI audio is active (processing, playing back, or welcome)
  const aiActive = isProcessing || isAudioPlaying || isWelcomePlaying;
  useEffect(() => {
    if (!aiActive) {
      setAiLevel(0);
      return;
    }
    let raf = 0;
    let phase = 0;
    const start = performance.now();

    const animate = (now: number) => {
      const t = ((now - start) % 4000) / 4000;
      phase += 0.18;
      const env = Math.sin(t * Math.PI);
      const wobble =
        (Math.sin(phase) * 0.4 + Math.sin(phase * 2.3) * 0.3 + 0.6) * 0.5;
      setAiLevel(Math.max(0, Math.min(1, env * (0.4 + wobble))));
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [aiActive]);

  // Orb level: AI animation when any AI audio active, mic when user is speaking
  const orbLevel = useMemo(() => {
    if (aiActive) return aiLevel;
    if (isRecording) return micLevel;
    return 0;
  }, [aiActive, aiLevel, isRecording, micLevel]);

  const status = !sessionStarted
    ? "Ready when you are"
    : isWelcomePlaying
    ? "Starting your session"
    : isProcessing || isAudioPlaying
    ? "AI Therapist is speaking"
    : isRecording
    ? "Listening to you"
    : isConnected
    ? "Connected · tap mic to speak"
    : "Session active";

  const handleStartSession = async () => {
    try {
      setError(null);
      const data = await startSession();
      setSessionId(data.sessionId);
      setSessionStarted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start session";
      setError(msg);
    }
  };

  const handleEndSession = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSessionStarted(false);
    setSessionId(null);
  };

  // Display text: show AI response or live transcript
  const displayText = sessionStarted
    ? text
      ? `"${text}"`
      : isProcessing
      ? "Processing your response…"
      : "I'm listening… take your time."
    : '"A safe, quiet space — whenever you need to talk."';

  return (
    <>
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
              {/* Mic toggle */}
              <button
                onClick={handleOnRecord}
                disabled={isProcessing}
                className="group flex flex-col items-center gap-2 disabled:opacity-50"
              >
                <div
                  className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${
                    isRecording
                      ? "bg-red-500/20 border-red-500/50 text-red-400"
                      : "border-white/20 hover:border-starlight/40 hover:bg-starlight/5 text-white/70"
                  }`}
                >
                  {isRecording ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </div>
                <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 group-hover:text-starlight transition-colors">
                  {isRecording ? "Stop" : "Speak"}
                </span>
              </button>

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
                v: isProcessing
                  ? "Reflecting"
                  : isRecording
                  ? "Listening"
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
        {sessionStarted && isConnected && (
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
