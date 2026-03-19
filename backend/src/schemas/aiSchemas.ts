import { z } from "zod";

export const GPTResponseSchema = z
  .string()
  .min(1, "GPT returned an empty response")
  .max(2000, "GPT response exceeds maximum length for TTS");

export const ElevenLabsInputSchema = z
  .string()
  .min(1, "Text input to ElevenLabs cannot be empty")
  .max(5000, "Text input exceeds ElevenLabs character limit");
