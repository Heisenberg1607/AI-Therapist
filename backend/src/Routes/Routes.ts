import express,{Router} from "express";

// import { generateResponse } from "../Controller/Controller"
import { getWelcomeMessage } from "../Controller/Controller";
import { startSession } from "../Controller/Controller";
import { login , register } from "../Controller/Controller";
import { authenticate } from "../middleware/authMiddleware";

const router: Router = express.Router();

// Public routes
router.post("/login", login);
router.post("/register", register);

// Health check route
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Protected routes (require authentication)
router.post("/startSession", authenticate, async (req, res, next) => {
  try {
    console.log("🎯 Starting new session");
    await startSession(req, res);
  } catch (error) {
    next(error);
  }
});

// Chat response route (protected)
// router.post("/getResponse", authenticate, async (req, res, next) => {
//   try {
//     console.log("📨 Incoming request:", req.body);
//     await generateResponse(req, res);
//   } catch (error) {
//     next(error);
//   }
// });

// Welcome Message route (protected)
router.get("/welcomeMessage", authenticate, getWelcomeMessage);


export default router;
