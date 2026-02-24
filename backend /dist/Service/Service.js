"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIgenerateResponse = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"; // Replace with actual API endpoint
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY; // Store securely
const AIgenerateResponse = async (userResponse) => {
    var _a;
    const prompt = `
You are a compassionate and experienced clinical psychologist conducting a virtual therapy session.

Your job is to:
- Validate the user's emotions
- Reflect on what they might be feeling without making assumptions
- Gently guide the conversation forward with an open-ended question

Only respond to the user message below. Do NOT provide explanations or commentary. Just reply as if you were speaking directly to the user in a calm, empathetic tone.

Examples:

User: I just feel so tired all the time, even when I get enough sleep.  
Therapist: It sounds like your exhaustion runs deeper than just physical tiredness. That kind of fatigue can be incredibly hard to carry. What do you think has been weighing on you lately?

User: I haven’t been enjoying anything recently. Things that used to make me happy feel empty now.  
Therapist: That feeling of emptiness can be so painful, especially when it takes away joy from the things you used to love. When did you first start noticing this change?

Now respond to the following message:

User: "${userResponse}"
`;
    try {
        console.log("Sending request to:", DEEPSEEK_API_URL);
        console.log("Request payload:", {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 500,
        });
        console.log("Headers:", {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        });
        const response = await axios_1.default.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 1.0,
            max_tokens: 1000,
        }, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
            },
        });
        const content = response.data.choices[0].message.content;
        return content;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            console.error("Axios error:", (_a = error.response) === null || _a === void 0 ? void 0 : _a.data);
        }
        else {
            console.error("Unexpected error:", error);
        }
        throw new Error("Failed to generate SOW");
    }
};
exports.AIgenerateResponse = AIgenerateResponse;
