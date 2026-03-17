import { ChatCompletionTool } from "openai/resources";

export const therapistTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "detect_crisis_intent",
      description:
        "Call this when the user expresses intent to harm themselves or others, mentions suicide, or shows signs of severe distress.",
      parameters: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Severity of the crisis signal",
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Specific phrases that triggered this",
          },
        },
        required: ["severity", "keywords"],
      },
    },
  },
];