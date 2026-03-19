import { prisma } from "../prisma/prismaClient";
import { DetectCrisisArgsSchema } from "../schemas/toolSchemas";

interface FunctionResult {
  status: "success" | "error" | "cancelled";
  result?: unknown;
  error?: string;
}

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
          console.error(
            `❌ [FUNCTION] Invalid args for detect_crisis_intent:`,
            parsed.error.message,
          );
          return { status: "error", error: `Invalid args: ${parsed.error.message}` };
        }

        const { severity, keywords } = parsed.data;

        await prisma.session.update({
          where: { id: sessionId },
          data: { crisisFlag: true },
        });

        onCrisisDetected();

        console.error(
          `🚨 CRISIS DETECTED for user ${userId} — severity: ${severity}, keywords: [${keywords.join(", ")}]`,
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
    return {
      status: "error",
      error:
        error instanceof Error ? error.message : "Function execution failed",
    };
  }
};