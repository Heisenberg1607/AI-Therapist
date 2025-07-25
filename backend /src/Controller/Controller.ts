// import { generateSpeechFromElevenLabs } from './../Service/ElevanLabsService';
import { Request, Response } from "express";
import { AIgenerateResponse } from "../Service/Service";
import { generateSpeechFromMurf } from "../Service/MurfService";
import { generateSpeechFromElevenLabs } from "../Service/ElevanLabsService";

export const generateResponse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userResponse } = req.body;

    if (!userResponse) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const AIResponse = await AIgenerateResponse(userResponse);
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
