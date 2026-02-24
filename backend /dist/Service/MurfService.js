"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSpeechFromMurf = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const generateSpeechFromMurf = async (text) => {
    var _a;
    const payload = {
        text: text,
        voiceId: "en-US-natalie", // You can change this to another voice
    };
    try {
        const response = await axios_1.default.post("https://api.murf.ai/v1/speech/generate", payload, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "api-key": process.env.MURF_API_KEY, // Store securely
            },
        });
        return response.data.audioFile;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            console.error("Murf API error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        }
        else {
            console.error("Unexpected error:", error);
        }
        throw new Error("Failed to generate speech from Murf.");
    }
};
exports.generateSpeechFromMurf = generateSpeechFromMurf;
