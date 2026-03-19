import { z } from "zod";

export const DetectCrisisArgsSchema = z.object({
  severity: z.enum(["low", "medium", "high"], {
    error: 'severity must be "low", "medium", or "high"',
  }),
  keywords: z
    .array(z.string())
    .min(1, "keywords must contain at least one entry"),
});

export type DetectCrisisArgs = z.infer<typeof DetectCrisisArgsSchema>;
