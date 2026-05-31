"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { OnboardingAnswers } from "@/lib/buildSystemPrompt";

type Question = {
  key: keyof OnboardingAnswers;
  question: string;
  options: string[];
};

const QUESTIONS: Question[] = [
  {
    key: "reason",
    question: "What brings you here today?",
    options: [
      "Anxiety",
      "Stress",
      "Relationship issues",
      "Loneliness",
      "Grief",
      "Just need to talk",
    ],
  },
  {
    key: "duration",
    question: "How long have you been feeling this way?",
    options: ["Just started", "A few weeks", "A few months", "Over a year"],
  },
  {
    key: "mood",
    question: "How would you describe your current mood?",
    options: [
      "Overwhelmed",
      "Numb",
      "Sad",
      "Anxious",
      "Angry",
      "Okay but struggling",
    ],
  },
  {
    key: "pastSupport",
    question: "Have you talked to anyone about this before?",
    options: [
      "No, never",
      "Tried but it didn't help",
      "Yes and it helped",
      "I have a therapist already",
    ],
  },
  {
    key: "supportStyle",
    question: "What kind of support feels right for you?",
    options: [
      "Just listen to me",
      "Help me understand my feelings",
      "Give me practical advice",
      "Check in on me regularly",
    ],
  },
  {
    key: "startingFeeling",
    question: "How are you feeling about starting this conversation?",
    options: ["Nervous", "Hopeful", "Skeptical", "Ready to open up"],
  },
];

type OnboardingProps = {
  onComplete: (answers: OnboardingAnswers) => void;
};

export const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});

  const current = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const progress = ((step + 1) / QUESTIONS.length) * 100;

  const handleSelect = (option: string) => {
    const next: OnboardingAnswers = { ...answers, [current.key]: option };
    setAnswers(next);

    if (isLast) {
      onComplete(next);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  return (
    <div
      className="relative min-h-screen text-white overflow-hidden flex flex-col"
      style={{ background: "hsl(240, 20%, 4%)" }}
    >
      {/* Ambient nebula background — matches the chat page */}
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

      {/* Top bar — back + progress */}
      <header className="relative z-10 flex items-center justify-between px-8 md:px-12 pt-20 pb-4">
        <button
          onClick={handleBack}
          disabled={step === 0}
          aria-label="Previous question"
          className="flex items-center gap-2 text-white/60 hover:text-starlight transition-colors disabled:opacity-0 disabled:pointer-events-none"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[10px] uppercase tracking-[0.3em]">Back</span>
        </button>

        <span className="text-[10px] uppercase tracking-[0.4em] text-starlight/80 font-medium">
          {step + 1} of {QUESTIONS.length}
        </span>
      </header>

      {/* Progress bar */}
      <div className="relative z-10 mx-8 md:mx-12 h-px bg-white/10">
        <div
          className="h-px bg-starlight transition-all duration-500 ease-out shadow-[0_0_8px_hsla(72,100%,70%,0.7)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question + options */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        {/* key forces the fade-in animation to replay on each question */}
        <div
          key={step}
          className="w-full max-w-xl flex flex-col items-center"
          style={{ animation: "fade-in 0.5s ease-out" }}
        >
          <p className="text-[10px] uppercase tracking-[0.4em] text-starlight/60 font-semibold mb-6">
            A few questions to begin
          </p>

          <h1
            className="text-3xl md:text-4xl text-white/90 leading-relaxed italic text-center mb-12"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {current.question}
          </h1>

          <div className="w-full flex flex-col gap-3">
            {current.options.map((option) => {
              const selected = answers[current.key] === option;
              return (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={`w-full px-6 py-4 rounded-2xl border text-left text-base md:text-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                    selected
                      ? "border-starlight/60 bg-starlight/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/80 hover:border-starlight/40 hover:bg-starlight/5"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <div className="relative z-10 pb-12 text-center">
        <span className="text-[9px] uppercase tracking-[0.3em] text-white/30">
          Your answers help tailor the conversation
        </span>
      </div>
    </div>
  );
};
