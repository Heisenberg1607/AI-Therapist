import express,{Router} from "express";

import { generateResponse } from "../Controller/Controller"

const router: Router = express.Router();

// Health check route
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
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


export default router;
