import { prisma } from "../prisma/prismaClient";
import { DetectCrisisArgsSchema } from "../schemas/toolSchemas";
import { logger } from "../utils/logger";
import { getCtx } from "../utils/turnContext";

interface FunctionResult {
  status: "success" | "error" | "cancelled";
  result?: unknown;
  error?: string;
}

const SEVERITY_CONFIDENCE: Record<string, number> = {
  low: 0.33,
  medium: 0.66,
  high: 0.99,
};

export const executeFunction = async (
  name: string,
  args: Record<string, unknown>,
  userId: string,
  sessionId: string,
  onCrisisDetected: () => void,
): Promise<FunctionResult> => {
  try {
    switch (name) {
      case "detect_crisis_intent": {
        const parsed = DetectCrisisArgsSchema.safeParse(args);
        if (!parsed.success) {
          logger.error(
            { ...getCtx(), layer: "guardrails", event: "guardrails.crisis_check", triggered: false },
            "detect_crisis_intent received invalid args",
          );
          return { status: "error", error: `Invalid args: ${parsed.error.message}` };
        }

        const { severity, keywords } = parsed.data;
        const t0 = Date.now();

        await prisma.session.update({
          where: { id: sessionId },
          data: { crisisFlag: true },
        });

        onCrisisDetected();

        const latencyMs = Date.now() - t0;

        // Layer 1 — Guardrails: log crisis detection result.
        // keywords are NOT logged (they can contain user speech fragments).
        logger.warn(
          {
            ...getCtx(),
            layer: "guardrails",
            event: "guardrails.crisis_check",
            triggered: true,
            confidence: SEVERITY_CONFIDENCE[severity] ?? 0.5,
            severity,
            keywordCount: keywords.length,
            latencyMs,
          },
          "crisis detected",
        );

        return {
          status: "success",
          result: {
            flagged: true,
            severity,
            keywords,
            resources: [
              "988 Suicide & Crisis Lifeline (call or text 988)",
              "Crisis Text Line (text HOME to 741741)",
              "Emergency services: 911",
            ],
            message: "Session has been flagged for review.",
          },
        };
      }

      default:
        return { status: "error", error: `Unknown function: ${name}` };
    }
  } catch (error) {
    logger.error(
      { ...getCtx(), layer: "guardrails", event: "guardrails.crisis_check", triggered: false, err: error },
      "crisis check threw",
    );
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Function execution failed",
    };
  }
};
