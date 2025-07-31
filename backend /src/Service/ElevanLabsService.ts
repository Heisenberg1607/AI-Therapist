import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.ELEVEN_LABS_API_KEY) {
  throw new Error("ELEVEN_LABS_API_KEY is not set in environment variables");
}

const elevenlabs = new ElevenLabsClient({
  apiKey:
    process.env.ELEVEN_LABS_API_KEY 

});

// Helper to convert ReadableStream to Buffer
const streamToBuffer = async (
  stream: ReadableStream<Uint8Array>
): Promise<Buffer> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks);
};

export const generateSpeechFromElevenLabs = async (
  text: string
): Promise<string> => {
  try {
    // Create audio directory if it doesn't exist
    const audioDir = path.join(__dirname, "../../audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const audioStream = await elevenlabs.textToSpeech.convert(
      "ADd2WEtjmwokqUr0Y5Ad",
      {
        text,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
      }
    );

    const audioBuffer = await streamToBuffer(
      audioStream as ReadableStream<Uint8Array>
    );

    const filename = `${uuidv4()}.mp3`;
    const filepath = path.join(audioDir, filename);

    // Write file synchronously
    fs.writeFileSync(filepath, audioBuffer);

    console.log(`Audio file saved to: ${filepath}`);

    return `http://localhost:5001/audio/${filename}`;
  } catch (error) {
    console.error("Error in generateSpeechFromElevenLabs:", error);
    throw new Error("Failed to generate speech from ElevenLabs");
  }
};
