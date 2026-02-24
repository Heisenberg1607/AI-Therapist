"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWelcomeMessage = exports.generateResponse = exports.startSession = exports.register = exports.login = void 0;
const Service_1 = require("../Service/Service");
const ElevanLabsService_1 = require("../Service/ElevanLabsService");
const client_1 = require("@prisma/client");
const messageModel_1 = require("../Model/messageModel");
const sessionModel_1 = require("../Model/sessionModel");
const userModel_1 = require("../Model/userModel");
const jwtUtils_1 = require("../utils/jwtUtils");
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }
        const user = await (0, userModel_1.findUserByEmail)(email);
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password." });
        }
        const isPasswordValid = await (0, userModel_1.verifyPassword)(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid password." });
        }
        const token = await (0, jwtUtils_1.generateToken)(user.id);
        res.status(200).json({
            message: "Login successful",
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
            token,
        });
    }
    catch (error) {
        console.error("Login error", error);
        res.status(500).json({ message: "Server error", error });
    }
};
exports.login = login;
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required." });
        }
        const existingUser = await (0, userModel_1.findUserByEmail)(email);
        if (existingUser) {
            return res.status(409).json({ message: "User already exists with this email." });
        }
        const user = await (0, userModel_1.createUser)(name, email, password);
        const token = await (0, jwtUtils_1.generateToken)(user.id);
        res.status(201).json({
            message: "User registered successsfully",
            user: {
                user,
                token
            }
        });
    }
    catch (error) {
        console.log("Register error", error);
        res.status(500).json({ message: "Server error", error });
    }
};
exports.register = register;
const startSession = async (req, res) => {
    try {
        const userId = req.userId;
        const session = await (0, sessionModel_1.createSession)(userId); // From the middleware
        res.status(201).json({ sessionId: session.id });
    }
    catch (error) {
        console.error("Error starting session:", error);
        res.status(500).json({ message: "Failed to start session" });
    }
};
exports.startSession = startSession;
// export const generateResponse = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { userResponse } = req.body;
//     if (!userResponse) {
//       res.status(400).json({ message: "Missing required fields" });
//       return;
//     }
//     const AIResponse = await AIgenerateResponse(userResponse);
//     // const murfResponse = await generateSpeechFromMurf(AIResponse);
//     const elevanLabsResponse = await generateSpeechFromElevenLabs(AIResponse);
//     console.log(elevanLabsResponse);
//     // Send response
//     res.status(201).json({
//         // text: AIResponse,
//       audio: elevanLabsResponse,
//     });
//   } catch (error) {
//     console.error("Error in createProject:", error);
//     res.status(500).json({ message: "Server error", error });
//   }
// };
const generateResponse = async (req, res) => {
    try {
        const { sessionId, userResponse } = req.body;
        if (!sessionId || !userResponse) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }
        await (0, messageModel_1.createMessage)(sessionId, client_1.Sender.USER, userResponse);
        const messages = await (0, messageModel_1.getMessagesBySession)(sessionId);
        const fullPrompt = messages
            .map((msg) => `${msg.sender === "USER" ? "User" : "AI"}: ${msg.content}`)
            .join("\n");
        const AIResponse = await (0, Service_1.AIgenerateResponse)(fullPrompt);
        await (0, messageModel_1.createMessage)(sessionId, client_1.Sender.AI, AIResponse);
        // const murfResponse = await generateSpeechFromMurf(AIResponse);
        const elevanLabsResponse = await (0, ElevanLabsService_1.generateSpeechFromElevenLabs)(AIResponse);
        console.log(elevanLabsResponse);
        // Send response
        res.status(201).json({
            // text: AIResponse,
            audio: elevanLabsResponse,
        });
    }
    catch (error) {
        console.error("Error in createProject:", error);
        res.status(500).json({ message: "Server error", error });
    }
};
exports.generateResponse = generateResponse;
const getWelcomeMessage = async (req, res) => {
    try {
        const welcomeMessage = "Hi, I’m really glad you’re here today. Before we begin, I want you to know that this is a safe and confidential space. There’s no judgment here—just a place for you to talk about whatever’s on your mind. We’ll go at your pace, and you only need to share what you feel comfortable with. This time is just for you.";
        const elevanLabsResponse = await (0, ElevanLabsService_1.generateSpeechFromElevenLabs)(welcomeMessage);
        console.log("Welcome message audio:", elevanLabsResponse);
        res.status(200).json({ message: welcomeMessage });
    }
    catch (error) {
        console.error("Error in getWelcomeMessage:", error);
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getWelcomeMessage = getWelcomeMessage;
