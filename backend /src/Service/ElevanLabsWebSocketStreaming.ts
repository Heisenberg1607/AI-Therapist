// backend/src/Service/ElevanLabsWebSocketStreaming.ts

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";

// Load env at module level
dotenv.config();

let elevenlabs: ElevenLabsClient | null = null;

const getElevenLabsClient = () => {
  if (!elevenlabs) {
    const apiKey = process.env.ELEVEN_LABS_API_KEY;

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY not found in environment variables");
    }

    elevenlabs = new ElevenLabsClient({ apiKey });
  }
  return elevenlabs;
};

export const streamSpeechWithElevenLabs = async (
  text: string,
  onChunk: (chunk: Uint8Array) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
) => {
  console.log("🎙️ [ELEVENLABS] Initializing client...");

  try {
    const client = getElevenLabsClient();
    console.log("✅ [ELEVENLABS] Client initialized");
    console.log("🎙️ [ELEVENLABS] Requesting stream for text:", text.substring(0, 50) + "...");

    const webStream = await client.textToSpeech.stream(
      process.env.ELEVENLABS_VOICE_ID || "ADd2WEtjmwokqUr0Y5Ad",
      {
        text,
        modelId: "eleven_flash_v2_5",
        outputFormat: "mp3_44100_128",
      },
    );

    console.log("✅ [ELEVENLABS] Stream started, reading chunks...");

    const reader = webStream.getReader();
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log(
          `✅ [ELEVENLABS] Stream complete. Total chunks: ${chunkCount}`,
        );
        onComplete();
        break;
      }

      if (value) {
        chunkCount++;
        console.log(
          `📦 [ELEVENLABS] Chunk ${chunkCount}: ${value.length} bytes`,
        );
        onChunk(value);
      }
    }
  } catch (error) {
    console.error("❌ [ELEVENLABS] Error:", error);
    onError(error as Error);
  }
};
