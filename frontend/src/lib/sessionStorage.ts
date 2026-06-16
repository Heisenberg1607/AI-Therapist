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
  /** Mood at the START of the session, derived from the transcript. */
  mood: string;
  /** Mood at the END of the session, derived from the transcript. */
  moodEnd?: string;
  /** Main topic (onboarding Q1). */
  topic: string;
  /** AI-generated 2-3 sentence summary. */
  summary: string;
  transcript: TranscriptTurn[];
};

// Maps a mood label to a numeric score (1 = worst, 6 = best) for the timeline chart.
// Ordered by emotional valence so a start→end change reads correctly (a higher
// score = a calmer/better state). The two anchors are firm — Overwhelmed is the
// most distressed, "Okay but struggling" the most settled; the middle four are all
// negative states, so their ordering is a judgement call you can tune.
export const MOOD_SCORES: Record<string, number> = {
  Overwhelmed: 1,
  Anxious: 2,
  Angry: 3,
  Sad: 4,
  Numb: 5,
  "Okay but struggling": 6,
};

// Short label per score (1..6) for chart Y-axis ticks. Must stay in valence
// order with MOOD_SCORES above ("Okay" is the short form of "Okay but struggling").
export const SCORE_LABELS: Record<number, string> = {
  1: "Overwhelmed",
  2: "Anxious",
  3: "Angry",
  4: "Sad",
  5: "Numb",
  6: "Okay",
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
