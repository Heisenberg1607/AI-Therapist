// import { generateSpeechFromElevenLabs } from './../Service/ElevanLabsService';
import { Request,Response } from "express";
import { AIgenerateResponse } from "../Service/Service";
// import { generateSpeechFromMurf } from "../Service/MurfService";
// import { generateSpeechFromElevenLabs } from "../Service/ElevanLabsService";
import { Sender, ReportType } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  createMessage,
  getMessagesBySession,
  getMessagesForUserSession,
} from "../Model/messageModel";
import {
  createSession,
  updateSessionSummary,
  getSessionsByUser,
  setSessionRating,
  getUngradedSessionIds,
  getRatedSessions,
  setSessionMoods,
  getSessionIdsMissingMood,
} from "../Model/sessionModel";
import {
  gradeSessionTranscript,
  overallScore,
  RATING_METRICS,
} from "../Service/sessionRatingService";
import { deriveSessionMoods } from "../Service/moodService";
import { getNearbyClinics } from "../Model/clinicModel";
import { getUserAnalytics, AnalyticsRange } from "../Model/analyticsModel";
import { createReport, getReportsByUser } from "../Model/reportModel";
import { generateReportContent } from "../Service/reportService";
import { renderReportPdf } from "../utils/reportPdf";
import { uploadReportFile, signedReportUrl } from "../utils/supabaseStorage";
import { AuthRequest } from "../middleware/authMiddleware";
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  getUserProfile,
  setUserOnboarding,
} from "../Model/userModel";
import { generateToken } from "../utils/jwtUtils";
import { logger } from "../utils/logger";


export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Passwordless accounts cannot login after Google auth removal.
    if (!user.password) {
      return res.status(401).json({ message: "Password login is not available for this account." });
    }

    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid){
    return res.status(401).json({ message: "Invalid password." });
    }

    const token = await generateToken(user.id);

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        onboarded: user.onboarded,
        onboardingData: user.onboardingData,
      },
      token,
    })
  } catch (error) {
    console.error("Login error", error);
    res.status(500).json({ message: "Server error", error });
  }
}

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if(!name || !email || !password){
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    const existingUser = await findUserByEmail(email);
    if(existingUser){
      return res.status(409).json({ message: "User already exists with this email." });
    }

    const user = await createUser(name, email, password);
    const token = await generateToken(user.id);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error) {
    console.log("Register error", error);
    res.status(500).json({ message: "Server error", error });
  }
}


export const startSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const session = await createSession(userId);

    console.log("session created successfully",session);
    

    // Layer 3 — Runtime: session created via HTTP
    logger.info(
      {
        layer: "runtime",
        event: "session.started",
        sessionId: session.id,
        turnId: "",
        userId,
      },
      "Session started",
    );

    res.status(201).json({ sessionId: session.id });
  } catch (error) {
    logger.error(
      { layer: "runtime", event: "session.started", sessionId: "", turnId: "", err: error },
      "Failed to start session",
    );
    res.status(500).json({ message: "Failed to start session" });
  }
};

// Return the authenticated user's profile incl. onboarding state.
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await getUserProfile(req.userId!);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (error) {
    console.error("getMe error", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Mark the user onboarded and persist their answers.
export const completeOnboarding = async (req: AuthRequest, res: Response) => {
  try {
    const { answers } = req.body;
    const user = await setUserOnboarding(req.userId!, answers ?? {});
    res.status(200).json({ user });
  } catch (error) {
    console.error("completeOnboarding error", error);
    res.status(500).json({ message: "Failed to save onboarding" });
  }
};

// Persist a session's AI summary + metadata (scoped to the owner).
export const saveSessionSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    // mood is intentionally ignored — it's derived from the transcript below,
    // not taken from the onboarding answer the client sends.
    const { summary, topic, durationSec } = req.body;
    const count = await updateSessionSummary(sessionId, req.userId!, {
      summary,
      topic,
      durationSec,
    });
    if (count === 0) {
      return res.status(404).json({ message: "Session not found" });
    }
    // Grade the just-finished session in the background (don't block the response).
    void gradeAndStoreSession(sessionId).catch((e: unknown) =>
      console.error("saveSessionSummary: grading failed", e),
    );
    // Derive start/end mood from the transcript in the background, too.
    void deriveAndStoreSessionMoods(sessionId).catch((e: unknown) =>
      console.error("saveSessionSummary: mood derivation failed", e),
    );
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("saveSessionSummary error", error);
    res.status(500).json({ message: "Failed to save summary" });
  }
};

// List the user's past sessions for the dashboard.
export const getSessions = async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await getSessionsByUser(req.userId!);
    res.status(200).json({ sessions });
  } catch (error) {
    console.error("getSessions error", error);
    res.status(500).json({ message: "Failed to fetch sessions" });
  }
};

// Full message thread for one of the user's sessions (ownership-scoped).
export const getSessionMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const messages = await getMessagesForUserSession(sessionId, req.userId!);
    if (messages === null) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.status(200).json({ messages });
  } catch (error) {
    console.error("getSessionMessages error", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

const ANALYTICS_RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "all"];

// User-specific analytics aggregated from the user's sessions + messages.
export const getAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.range);
    const range = (ANALYTICS_RANGES as string[]).includes(q)
      ? (q as AnalyticsRange)
      : "30d";
    const analytics = await getUserAnalytics(req.userId!, range);
    res.status(200).json({ analytics });
  } catch (error) {
    console.error("getAnalytics error", error);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

// ---- Reports -----------------------------------------------------------

const REPORT_SESSION_COUNT = 3;
const UPLOAD_MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

// Generate a clinical report from the user's last 3 sessions, render a PDF,
// store it privately, and persist a Report row.
export const generateReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const recent = (await getSessionsByUser(userId)).slice(0, REPORT_SESSION_COUNT);
    if (recent.length === 0) {
      return res.status(400).json({ message: "No sessions to generate a report from." });
    }

    // Oldest-of-the-three first, so the report reads chronologically.
    const blocks: string[] = [];
    for (const s of [...recent].reverse()) {
      const messages = await getMessagesBySession(s.id);
      if (messages.length === 0) continue;
      const lines = messages.map(
        (m) => `${m.sender === "USER" ? "Client" : "Therapist"}: ${m.content}`,
      );
      const dateStr = s.createdAt.toISOString().slice(0, 10);
      blocks.push(
        `--- Session on ${dateStr}${s.topic ? ` (topic: ${s.topic})` : ""} ---\n${lines.join("\n")}`,
      );
    }
    if (blocks.length === 0) {
      return res
        .status(400)
        .json({ message: "Not enough conversation history to generate a report." });
    }

    let content;
    try {
      content = await generateReportContent(blocks.join("\n\n"));
    } catch (error) {
      console.error("generateReport: OpenAI step failed", error);
      return res.status(500).json({ message: "Failed to generate report content." });
    }

    const id = randomUUID();
    let pdf: Buffer;
    try {
      pdf = await renderReportPdf(content.title, content.report);
    } catch (error) {
      console.error("generateReport: PDF step failed", error);
      return res.status(500).json({ message: "Failed to render report PDF." });
    }

    const filePath = `${userId}/${id}.pdf`;
    try {
      await uploadReportFile(filePath, pdf, "application/pdf");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown storage error";
      console.error("generateReport: Supabase upload failed", error);
      return res.status(500).json({
        message:
          msg.includes("SUPABASE") || msg.includes("supabase")
            ? "Report storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server."
            : "Failed to upload report file. Ensure the Supabase 'reports' bucket exists.",
      });
    }

    let report;
    try {
      report = await createReport({
        id,
        userId,
        type: ReportType.GENERATED,
        title: content.title,
        summary: content.report,
        mostCommonIssues: content.mostCommonIssues,
        filePath,
        fileType: "application/pdf",
      });
    } catch (error) {
      console.error("generateReport: DB step failed", error);
      return res.status(500).json({
        message:
          "Failed to save report. Run database migrations (Report table may be missing).",
      });
    }

    const url = await signedReportUrl(filePath);
    res.status(201).json({ report: { ...report, url } });
  } catch (error) {
    console.error("generateReport error", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

// List the user's reports with fresh signed download URLs.
export const listReports = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await getReportsByUser(req.userId!);
    const withUrls = await Promise.all(
      reports.map(async (r) => ({
        ...r,
        url: await signedReportUrl(r.filePath).catch(() => null),
      })),
    );
    res.status(200).json({ reports: withUrls });
  } catch (error) {
    console.error("listReports error", error);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
};

// Store a user-uploaded report file (PDF/DOCX) and persist a Report row.
export const uploadReport = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    // multer populates req.file; type it locally to avoid relying on global augmentation.
    const file = (req as unknown as {
      file?: { buffer: Buffer; mimetype: string; originalname: string };
    }).file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded." });
    }
    const ext = UPLOAD_MIME_EXT[file.mimetype];
    if (!ext) {
      return res.status(400).json({ message: "Only PDF or DOCX files are allowed." });
    }

    const id = randomUUID();
    const filePath = `${userId}/${id}.${ext}`;
    await uploadReportFile(filePath, file.buffer, file.mimetype);

    const report = await createReport({
      id,
      userId,
      type: ReportType.UPLOADED,
      title: file.originalname || `Uploaded report.${ext}`,
      summary: null,
      mostCommonIssues: [],
      filePath,
      fileType: file.mimetype,
    });

    const url = await signedReportUrl(filePath);
    res.status(201).json({ report: { ...report, url } });
  } catch (error) {
    console.error("uploadReport error", error);
    res.status(500).json({ message: "Failed to upload report" });
  }
};

// ---- Session ratings (LLM-as-judge) -----------------------------------

const MAX_BACKFILL = 50;

// Grade one session's transcript on the 5 metrics and persist the scores.
// Returns null when the session has no messages. Safe to call fire-and-forget.
async function gradeAndStoreSession(sessionId: string) {
  const messages = await getMessagesBySession(sessionId);
  if (messages.length === 0) return null;
  const transcript = messages
    .map((m) => `${m.sender === "USER" ? "Client" : "Therapist"}: ${m.content}`)
    .join("\n");
  const scores = await gradeSessionTranscript(transcript);
  const overall = overallScore(scores);
  await setSessionRating(sessionId, scores, overall);
  return { scores, overall };
}

// Grade all of the user's not-yet-graded sessions (capped per request).
export const backfillRatings = async (req: AuthRequest, res: Response) => {
  try {
    const ids = (await getUngradedSessionIds(req.userId!)).slice(0, MAX_BACKFILL);
    let graded = 0;
    for (const id of ids) {
      try {
        const result = await gradeAndStoreSession(id);
        if (result) graded++;
      } catch (e) {
        console.error("backfillRatings: failed to grade", id, e);
      }
    }
    res.status(200).json({ graded });
  } catch (error) {
    console.error("backfillRatings error", error);
    res.status(500).json({ message: "Failed to backfill ratings" });
  }
};

// Derive one session's start/end mood from its transcript and persist it.
// Returns null when the session has no messages. Safe to call fire-and-forget.
async function deriveAndStoreSessionMoods(sessionId: string) {
  const messages = await getMessagesBySession(sessionId);
  if (messages.length === 0) return null;
  const transcript = messages
    .map((m) => `${m.sender === "USER" ? "Client" : "Therapist"}: ${m.content}`)
    .join("\n");
  const moods = await deriveSessionMoods(transcript);
  await setSessionMoods(sessionId, moods.moodStart, moods.moodEnd);
  return moods;
}

// Derive moods for all of the user's sessions that don't have one yet
// (capped per request). Backfills the mood timeline from stored transcripts.
export const backfillMoods = async (req: AuthRequest, res: Response) => {
  try {
    const ids = (await getSessionIdsMissingMood(req.userId!)).slice(0, MAX_BACKFILL);
    let derived = 0;
    for (const id of ids) {
      try {
        const result = await deriveAndStoreSessionMoods(id);
        if (result && (result.moodStart || result.moodEnd)) derived++;
      } catch (e) {
        console.error("backfillMoods: failed to derive", id, e);
      }
    }
    res.status(200).json({ derived });
  } catch (error) {
    console.error("backfillMoods error", error);
    res.status(500).json({ message: "Failed to backfill moods" });
  }
};

// Average session rating across the user's graded sessions (per metric + overall).
export const getRatingsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const rated = await getRatedSessions(req.userId!);
    if (rated.length === 0) {
      return res.status(200).json({ ratings: null });
    }
    const sums: Record<string, number> = {};
    for (const m of RATING_METRICS) sums[m] = 0;
    let overallSum = 0;
    for (const s of rated) {
      const scores = (s.ratingScores as unknown as Record<string, number>) ?? {};
      for (const m of RATING_METRICS) sums[m] += Number(scores[m] ?? 0);
      overallSum += Number(s.ratingOverall ?? 0);
    }
    const n = rated.length;
    const round1 = (total: number) => Math.round((total / n) * 10) / 10;
    res.status(200).json({
      ratings: {
        count: n,
        overall: round1(overallSum),
        metrics: RATING_METRICS.map((m) => ({ metric: m, score: round1(sums[m]) })),
      },
    });
  } catch (error) {
    console.error("getRatingsSummary error", error);
    res.status(500).json({ message: "Failed to fetch ratings" });
  }
};

// Clinics returned per page (server-side pagination).
const CLINIC_PAGE_SIZE = 7;

// List nearby behavioral-health clinics, paginated. Public (gov-sourced data).
// Query params: lat, lng (optional pair) → distance-ranked; q → name/specialty
// search; specialty → specialty-tag filter; sort = distance|name;
// radius (meters, default 40000); page (1-based, default 1).
export const getClinics = async (req: Request, res: Response) => {
  try {
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const lat = num(req.query.lat);
    const lng = num(req.query.lng);
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const specialty =
      typeof req.query.specialty === "string" ? req.query.specialty : undefined;
    const sort = req.query.sort === "name" ? "name" : "distance";
    const radiusM = num(req.query.radius);
    const page = Math.max(num(req.query.page) ?? 1, 1);

    // lat/lng must come as a pair, or not at all.
    if ((lat == null) !== (lng == null)) {
      return res
        .status(400)
        .json({ message: "Provide both lat and lng, or neither." });
    }

    const { clinics, total } = await getNearbyClinics({
      lat,
      lng,
      q,
      specialty,
      sort,
      radiusM,
      page,
      pageSize: CLINIC_PAGE_SIZE,
    });

    res.status(200).json({ clinics, total, page, pageSize: CLINIC_PAGE_SIZE });
  } catch (error) {
    console.error("getClinics error", error);
    res.status(500).json({ message: "Failed to fetch clinics" });
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

// export const generateResponse = async (
//   req: AuthRequest,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { sessionId,userResponse } = req.body;

//     if (!sessionId || !userResponse) {
//       res.status(400).json({ message: "Missing required fields" });
//       return;
//     }

//     await createMessage(sessionId, Sender.USER, userResponse);

//     const messages = await getMessagesBySession(sessionId);

//     const fullPrompt = messages
//       .map((msg) => `${msg.sender === "USER" ? "User" : "AI"}: ${msg.content}`)
//       .join("\n");

//     const AIResponse = await AIgenerateResponse(fullPrompt);

//     await createMessage(sessionId, Sender.AI, AIResponse);

//     // const murfResponse = await generateSpeechFromMurf(AIResponse);
//     const elevanLabsResponse = await generateSpeechFromElevenLabs(AIResponse);
//     console.log(elevanLabsResponse);

//     // Send response
//     res.status(201).json({
//       // text: AIResponse,
//       audio: elevanLabsResponse,
//     });
//   } catch (error) {
//     console.error("Error in createProject:", error);
//     res.status(500).json({ message: "Server error", error });
//   }
// };


// export const getWelcomeMessage = async (
//   req: AuthRequest,
//   res: Response
// ): Promise<void> => {
//   try {
//     const welcomeMessage =
//       "Hi, I’m really glad you’re here today. Before we begin, I want you to know that this is a safe and confidential space. There’s no judgment here—just a place for you to talk about whatever’s on your mind. We’ll go at your pace, and you only need to share what you feel comfortable with. This time is just for you.";
//     const elevanLabsResponse = await generateSpeechFromElevenLabs(welcomeMessage);

//     console.log("Welcome message audio:", elevanLabsResponse);
//     res.status(200).json({ message: welcomeMessage });
//   } catch (error) {
//     console.error("Error in getWelcomeMessage:", error);
//     res.status(500).json({ message: "Server error", error });
//   }
// };


