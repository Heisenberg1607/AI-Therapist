// Service/ElevenWebSocketService.ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const elevenlabs = new ElevenLabsClient({
  apiKey: "sk_25e3781fbb228ec509129fea7bbb407698c829fe7f7a318a",
});

export const streamSpeechWithElevenLabs = async (
  text: string,
  onData: (chunk: Uint8Array) => void,
  onEnd: () => void,
  onError: (err: Error) => void
) => {
  try {
    const webStream = await elevenlabs.textToSpeech.stream(
      "By3uo6OtMBFXX4Xtb7sG", // Your voiceId
      {
        text,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
      }
    );

    const reader = webStream.getReader();

    const read = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) onData(value);
        }
        onEnd();
      } catch (err) {
        onError(err as Error);
      }
    };

    await read();
  } catch (error) {
    onError(error as Error);
  }
};
