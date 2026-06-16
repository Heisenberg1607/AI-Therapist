import { OpenAI } from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set in environment variables");
}
const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// The 6 mood labels the client picks from at onboarding — reused here so the
// derived mood maps onto the same chart scale (see MOOD_SCORES on the frontend).
// Order here is irrelevant; the valence ranking lives in the frontend.
export const MOOD_LABELS = [
  "Overwhelmed",
  "Numb",
  "Sad",
  "Anxious",
  "Angry",
  "Okay but struggling",
] as const;

export type MoodLabel = (typeof MOOD_LABELS)[number];

export interface SessionMoods {
  moodStart: MoodLabel | null; // null when there isn't enough signal to classify
  moodEnd: MoodLabel | null;
}

const SYSTEM_PROMPT = `You analyze a transcript of a therapy session between a CLIENT and an AI therapist.
Judge ONLY the CLIENT's emotional state (never the therapist's), classifying it into exactly one of these
six labels — copy the label text verbatim:
- "Overwhelmed"
- "Numb"
- "Sad"
- "Anxious"
- "Angry"
- "Okay but struggling"

Give two readings:
- moodStart: the client's mood during the OPENING of the conversation (their first messages).
- moodEnd: the client's mood by the CLOSE of the conversation (their last messages).
Pick the single closest label for each, grounded only in what the client says. If the transcript is too
short or empty to judge a reading, use null for that field.

Return ONLY valid JSON, no markdown:
{"moodStart":"<label or null>","moodEnd":"<label or null>"}`;

// Case-insensitive match of a model-returned value onto a canonical MOOD_LABEL.
function normalizeLabel(value: unknown): MoodLabel | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return MOOD_LABELS.find((l) => l.toLowerCase() === v) ?? null;
}

// Classify the client's start- and end-of-session mood from a rendered transcript
// (e.g. "Client: ...\nTherapist: ...\n..."). Returns nulls on empty input.
export async function deriveSessionMoods(
  transcript: string,
): Promise<SessionMoods> {
  if (!transcript.trim()) return { moodStart: null, moodEnd: null };

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let data: { moodStart?: unknown; moodEnd?: unknown };
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }

  return {
    moodStart: normalizeLabel(data.moodStart),
    moodEnd: normalizeLabel(data.moodEnd),
  };
}
