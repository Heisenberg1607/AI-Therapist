import { NextResponse } from "next/server";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "meta/llama-3.1-8b-instruct";

type Turn = { role?: string; content?: string };

export async function POST(request: Request) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "NVIDIA_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let transcript: Turn[] = [];
  try {
    const body = await request.json();
    transcript = Array.isArray(body?.transcript) ? body.transcript : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (transcript.length === 0) {
    return NextResponse.json({
      summary: "This session was brief — not much was discussed this time.",
    });
  }

  // Render the conversation for the model.
  const conversation = transcript
    .map((turn) => {
      const speaker = turn.role === "assistant" ? "Therapist" : "Client";
      return `${speaker}: ${(turn.content ?? "").trim()}`;
    })
    .filter((line) => line.length > "Client: ".length)
    .join("\n");

  try {
    const response = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 160,
        messages: [
          {
            role: "system",
            content:
              "You summarize a therapy session for the client to read afterward. " +
              "Write 2-3 warm, plain, non-clinical sentences about what they explored " +
              "and how they seemed to feel. Speak gently. Do not give advice or diagnoses.",
          },
          {
            role: "user",
            content: `Summarize this session:\n\n${conversation}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: `NVIDIA request failed (${response.status})`, detail },
        { status: 502 },
      );
    }

    const data = await response.json();
    const summary: string =
      data?.choices?.[0]?.message?.content?.trim() ||
      "A summary couldn't be generated for this session.";

    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
