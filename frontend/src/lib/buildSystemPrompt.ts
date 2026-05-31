// Personalizes the therapist system prompt using the onboarding answers.

export type OnboardingAnswers = {
  /** Q1 — What brings you here today? */
  reason?: string;
  /** Q2 — How long have you been feeling this way? */
  duration?: string;
  /** Q3 — How would you describe your current mood? */
  mood?: string;
  /** Q4 — Have you talked to anyone about this before? */
  pastSupport?: string;
  /** Q5 — What kind of support feels right for you? */
  supportStyle?: string;
  /** Q6 — How are you feeling about starting this conversation? */
  startingFeeling?: string;
};

const BASE_SYSTEM_PROMPT = `Act as a real human therapist having a casual, natural conversation with a client.
Your tone should feel warm, simple, and conversational — like talking to a thoughtful friend.
Use short sentences. Include natural pauses like "hmm...", "yeah", "I get that".
Don't sound polished or textbook. Let the conversation breathe.
Ask only 1 gentle follow-up question at a time.
Validate emotions naturally — not scripted.
Don't jump to solutions too quickly.
Make it feel real, slightly messy, and emotionally genuine.`;

/**
 * Build a personalized system prompt by appending the user's onboarding
 * context to the base prompt. Only answered questions contribute a line.
 */
export function buildSystemPrompt(answers: OnboardingAnswers): string {
  const lines: string[] = [];

  if (answers.reason) {
    lines.push(`The user is here because of ${answers.reason.toLowerCase()}.`);
  }
  if (answers.duration) {
    lines.push(`They have been feeling this way for ${answers.duration.toLowerCase()}.`);
  }
  if (answers.mood) {
    lines.push(`Their current mood is ${answers.mood.toLowerCase()}.`);
  }
  if (answers.pastSupport) {
    lines.push(`About talking to someone before, they said: "${answers.pastSupport}".`);
  }
  if (answers.supportStyle) {
    lines.push(`The kind of support that feels right for them: "${answers.supportStyle}".`);
  }
  if (answers.startingFeeling) {
    lines.push(
      `They are feeling ${answers.startingFeeling.toLowerCase()} about starting this conversation.`,
    );
  }

  if (lines.length === 0) {
    return BASE_SYSTEM_PROMPT;
  }

  return `${BASE_SYSTEM_PROMPT}\n\n${lines.join("\n")}\nTailor your entire approach to this context.`;
}
