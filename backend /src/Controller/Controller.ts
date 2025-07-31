// import { generateSpeechFromElevenLabs } from './../Service/ElevanLabsService';
import { Request, Response } from "express";
import { AIgenerateResponse } from "../Service/Service";
import { generateSpeechFromMurf } from "../Service/MurfService";
import { generateSpeechFromElevenLabs } from "../Service/ElevanLabsService";
import { Sender } from "@prisma/client";
import { createMessage, getMessagesBySession } from "../Model/messageModel";
import { createSession } from "../Model/sessionModel";


export const startSession = async (req: Request, res: Response) => {
  try {
    const session = await createSession(); // no userId
    res.status(201).json({ sessionId: session.id });
  } catch (error) {
    console.error("Error starting session:", error);
    res.status(500).json({ message: "Failed to start session" });
  }
};

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

export const generateResponse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { sessionId,userResponse } = req.body;

    if (!sessionId || !userResponse) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    await createMessage(sessionId, Sender.USER, userResponse);

    const messages = await getMessagesBySession(sessionId);

    const fullPrompt = messages
      .map((msg) => `${msg.sender === "USER" ? "User" : "AI"}: ${msg.content}`)
      .join("\n");

    const AIResponse = await AIgenerateResponse(fullPrompt);

    await createMessage(sessionId, Sender.AI, AIResponse);

    // const murfResponse = await generateSpeechFromMurf(AIResponse);
    const elevanLabsResponse = await generateSpeechFromElevenLabs(AIResponse);
    console.log(elevanLabsResponse);

    // Send response
    res.status(201).json({
      // text: AIResponse,
      audio: elevanLabsResponse,
    });
  } catch (error) {
    console.error("Error in createProject:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


export const getWelcomeMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const welcomeMessage =
      "Hi, I’m really glad you’re here today. Before we begin, I want you to know that this is a safe and confidential space. There’s no judgment here—just a place for you to talk about whatever’s on your mind. We’ll go at your pace, and you only need to share what you feel comfortable with. This time is just for you.";
    const elevanLabsResponse = await generateSpeechFromElevenLabs(welcomeMessage);

    console.log("Welcome message audio:", elevanLabsResponse);
    res.status(200).json({ message: welcomeMessage });
  } catch (error) {
    console.error("Error in getWelcomeMessage:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
