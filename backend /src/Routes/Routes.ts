import express,{Router} from "express";

import { generateResponse } from "../Controller/Controller"
import { getWelcomeMessage } from "../Controller/Controller";
import {startSession} from "../Controller/Controller";

const router: Router = express.Router();

// Health check route
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

router.post("/startSession", async (req, res, next) => {
  try {
    console.log("🎯 Starting new session");
    await startSession(req, res);
  } catch (error) {
    next(error);
  }
});

// Chat response route
router.post("/getResponse", async (req, res, next) => {
  try {
    console.log("📨 Incoming request:", req.body);
    await generateResponse(req, res);
  } catch (error) {
    next(error);
  }
});




// Welcome Message route
router.get("/welcomeMessage", getWelcomeMessage);


export default router;
