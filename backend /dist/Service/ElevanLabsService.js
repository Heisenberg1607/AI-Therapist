"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSpeechFromElevenLabs = void 0;
const elevenlabs_js_1 = require("@elevenlabs/elevenlabs-js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (!process.env.ELEVEN_LABS_API_KEY) {
    throw new Error("ELEVEN_LABS_API_KEY is not set in environment variables");
}
const elevenlabs = new elevenlabs_js_1.ElevenLabsClient({
    apiKey: process.env.ELEVEN_LABS_API_KEY
});
// Helper to convert ReadableStream to Buffer
const streamToBuffer = async (stream) => {
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        if (value)
            chunks.push(value);
    }
    return Buffer.concat(chunks);
};
const generateSpeechFromElevenLabs = async (text) => {
    try {
        // Create audio directory if it doesn't exist
        const audioDir = path_1.default.join(__dirname, "../../audio");
        if (!fs_1.default.existsSync(audioDir)) {
            fs_1.default.mkdirSync(audioDir, { recursive: true });
        }
        const audioStream = await elevenlabs.textToSpeech.convert("ADd2WEtjmwokqUr0Y5Ad", {
            text,
            modelId: "eleven_multilingual_v2",
            outputFormat: "mp3_44100_128",
        });
        const audioBuffer = await streamToBuffer(audioStream);
        const filename = `${(0, uuid_1.v4)()}.mp3`;
        const filepath = path_1.default.join(audioDir, filename);
        // Write file synchronously
        fs_1.default.writeFileSync(filepath, audioBuffer);
        console.log(`Audio file saved to: ${filepath}`);
        return `http://localhost:5001/audio/${filename}`;
    }
    catch (error) {
        console.error("Error in generateSpeechFromElevenLabs:", error);
        throw new Error("Failed to generate speech from ElevenLabs");
    }
};
exports.generateSpeechFromElevenLabs = generateSpeechFromElevenLabs;
