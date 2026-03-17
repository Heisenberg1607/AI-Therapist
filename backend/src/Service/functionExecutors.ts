import { prisma } from "../prisma/prismaClient";

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
        // Flag session in DB
        await prisma.session.update({
          where: { id: sessionId },
          data: { crisisFlag: true }, // add this 
          // field to schema
        });
        onCrisisDetected();
        // You could also: send alert email, notify admin, etc.
        console.error(
          `🚨 CRISIS DETECTED for user ${userId}: ${JSON.stringify(args)}`,
        );
        return {
          status: "success",
          result: {
            flagged: true,
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