// Local persistence for completed therapy sessions (client-side only).

const STORAGE_KEY = "ai_therapist_sessions";

export type TranscriptTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

export type SessionData = {
  id: string;
  /** ISO timestamp of when the session ended. */
  date: string;
  /** Duration in seconds. */
  duration: number;
  /** Mood at start of session (onboarding Q3). */
  mood: string;
  /** Main topic (onboarding Q1). */
  topic: string;
  /** AI-generated 2-3 sentence summary. */
  summary: string;
  transcript: TranscriptTurn[];
};

// Maps onboarding mood answers to a numeric score for the timeline chart.
export const MOOD_SCORES: Record<string, number> = {
  Overwhelmed: 1,
  Numb: 2,
  Sad: 3,
  Anxious: 4,
  Angry: 5,
  "Okay but struggling": 6,
};

export function moodToScore(mood: string): number {
  return MOOD_SCORES[mood] ?? 0;
}

export function getSessions(): SessionData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionData[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: SessionData): void {
  if (typeof window === "undefined") return;
  try {
    const sessions = getSessions();
    sessions.push(session);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage unavailable / quota exceeded — fail silently.
  }
}

export function getLatestSession(): SessionData | null {
  const sessions = getSessions();
  if (sessions.length === 0) return null;
  // Most recent by date; falls back to insertion order.
  return [...sessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )[0];
}
