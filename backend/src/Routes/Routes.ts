import express,{Router} from "express";

// import { generateResponse } from "../Controller/Controller"
// import { getWelcomeMessage } from "../Controller/Controller";
import { startSession } from "../Controller/Controller";
import { login , register } from "../Controller/Controller";
import {
  getMe,
  completeOnboarding,
  saveSessionSummary,
  getSessions,
  getSessionMessages,
  getClinics,
} from "../Controller/Controller";
import { authenticate } from "../middleware/authMiddleware";

const router: Router = express.Router();

// Public routes
router.post("/login", login);
router.post("/register", register);

// Health check route
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Nearby clinics (public — gov-sourced behavioral-health directory)
router.get("/clinics", async (req, res, next) => {
  try {
    await getClinics(req, res);
  } catch (error) {
    next(error);
  }
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

// Current user profile (incl. onboarding state)
router.get("/me", authenticate, async (req, res, next) => {
  try {
    await getMe(req, res);
  } catch (error) {
    next(error);
  }
});

// Persist onboarding answers + flag
router.post("/onboarding", authenticate, async (req, res, next) => {
  try {
    await completeOnboarding(req, res);
  } catch (error) {
    next(error);
  }
});

// List the user's past sessions (for the dashboard)
router.get("/sessions", authenticate, async (req, res, next) => {
  try {
    await getSessions(req, res);
  } catch (error) {
    next(error);
  }
});

// Save a session's summary + metadata
router.post("/sessions/:sessionId/summary", authenticate, async (req, res, next) => {
  try {
    await saveSessionSummary(req, res);
  } catch (error) {
    next(error);
  }
});

// Full message thread for one of the user's sessions
router.get("/sessions/:sessionId/messages", authenticate, async (req, res, next) => {
  try {
    await getSessionMessages(req, res);
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
// router.get("/welcomeMessage", authenticate, getWelcomeMessage);


export default router;
