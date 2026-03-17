import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

interface MurfResponse {
  audioFile: string;
  audioLengthInSeconds: number;
  wordDurations: Array<{
    word: string;
    startMs: number;
    endMs: number;
  }>;
}
export const generateSpeechFromMurf = async (
  text: string
): Promise<string> => {
  const payload = {
    text: text,
    voiceId: "en-US-natalie", // You can change this to another voice
  };

  try {
    const response = await axios.post<MurfResponse>(
      "https://api.murf.ai/v1/speech/generate",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "api-key":
            process.env.MURF_API_KEY , // Store securely
        },
      }
    );

    return response.data.audioFile;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error("Murf API error:", error.response?.data || error.message);
    } else {
      console.error("Unexpected error:", error);
    }
    throw new Error("Failed to generate speech from Murf.");
  }
};
