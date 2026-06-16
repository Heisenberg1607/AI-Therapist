import { OpenAI } from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set in environment variables");
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

export interface GeneratedReport {
  title: string;
  report: string; // markdown body
  mostCommonIssues: string[];
}

const SYSTEM_PROMPT = `You are a clinical documentation assistant for a voice-based AI therapy app.
You are given transcripts of a client's most recent therapy sessions (the client speaks with an AI
therapist). Write a detailed, professional report that the CLIENT can hand to their human therapist to
inform further treatment.

The report (markdown) should include these sections:
- Overview (period covered, number of sessions)
- Presenting concerns
- Recurring themes & emotional patterns
- Notable disclosures
- Risk indicators (note any mentions of self-harm, crisis, or safety concerns; if none, say so)
- Progress / changes across the sessions
- Suggested focus areas for the human therapist

Be specific and grounded ONLY in what the transcripts contain — do not invent facts. Use a calm, clinical,
non-judgmental tone. Then extract the 3–6 most common issues as short tags (e.g. "Work anxiety",
"Sleep difficulty").

Return ONLY valid JSON, no markdown fences:
{"title": "<short report title>", "report": "<markdown report>", "mostCommonIssues": ["<tag>", ...]}`;

// Generate a clinical report + most-common-issues from recent session transcripts.
export async function generateReportContent(
  transcripts: string,
): Promise<GeneratedReport> {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcripts },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let data: { title?: unknown; report?: unknown; mostCommonIssues?: unknown };
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }

  const title = String(data.title || "Therapy Session Report").trim();
  const report = String(data.report || "").trim();
  const mostCommonIssues = Array.isArray(data.mostCommonIssues)
    ? data.mostCommonIssues
        .map((x) => String(x).trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return { title, report, mostCommonIssues };
}
