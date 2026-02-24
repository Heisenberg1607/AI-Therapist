"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamSpeechWithElevenLabs = void 0;
// Service/ElevenWebSocketService.ts
const elevenlabs_js_1 = require("@elevenlabs/elevenlabs-js");
const elevenlabs = new elevenlabs_js_1.ElevenLabsClient({
    apiKey: "sk_25e3781fbb228ec509129fea7bbb407698c829fe7f7a318a",
});
const streamSpeechWithElevenLabs = async (text, onData, onEnd, onError) => {
    try {
        const webStream = await elevenlabs.textToSpeech.stream("By3uo6OtMBFXX4Xtb7sG", // Your voiceId
        {
            text,
            modelId: "eleven_multilingual_v2",
            outputFormat: "mp3_44100_128",
        });
        const reader = webStream.getReader();
        const read = async () => {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    if (value)
                        onData(value);
                }
                onEnd();
            }
            catch (err) {
                onError(err);
            }
        };
        await read();
    }
    catch (error) {
        onError(error);
    }
};
exports.streamSpeechWithElevenLabs = streamSpeechWithElevenLabs;
