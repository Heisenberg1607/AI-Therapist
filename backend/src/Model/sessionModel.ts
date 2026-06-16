import { prisma } from "../prisma/prismaClient";
import { Prisma } from "@prisma/client";

export const createSession = async (userId?: string) => {
  const sessionData: any = {};
  if (userId) {
    sessionData.userId = userId;
  }
  return await prisma.session.create({
    data: sessionData,
  });
};

export const getSessionById = async (sessionId: string) => {
  return await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: true },
  });
};

type SessionSummaryInput = {
  summary?: string;
  topic?: string;
  durationSec?: number;
};

// Update a session's summary/metadata, scoped to the owning user.
// NOTE: mood is no longer written here — it's derived from the transcript
// (see setSessionMoods), not taken from the onboarding answer.
export const updateSessionSummary = async (
  sessionId: string,
  userId: string,
  data: SessionSummaryInput,
) => {
  const result = await prisma.session.updateMany({
    where: { id: sessionId, userId },
    data: {
      summary: data.summary,
      topic: data.topic,
      durationSec: data.durationSec,
    },
  });
  return result.count; // 0 if not found / not owned
};

// Persist the transcript-derived start/end moods for a session.
// `mood` holds the start-of-session mood; `moodEnd` the end-of-session mood.
export const setSessionMoods = async (
  sessionId: string,
  moodStart: string | null,
  moodEnd: string | null,
) => {
  return prisma.session.update({
    where: { id: sessionId },
    data: { mood: moodStart, moodEnd },
  });
};

// Sessions still missing a derived mood (no start mood yet), newest first.
// Used by the mood backfill to find sessions to score from their transcripts.
export const getSessionIdsMissingMood = async (
  userId: string,
): Promise<string[]> => {
  const rows = await prisma.session.findMany({
    where: { userId, mood: null },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => r.id);
};

// All sessions for a user, newest first — fields the dashboard needs.
export const getSessionsByUser = async (userId: string) => {
  return await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      summary: true,
      mood: true,
      moodEnd: true,
      topic: true,
      durationSec: true,
      crisisFlag: true,
    },
  });
};

// Persist LLM-judge rating scores for a session.
export const setSessionRating = async (
  sessionId: string,
  scores: Record<string, number>,
  overall: number,
) => {
  return prisma.session.update({
    where: { id: sessionId },
    data: {
      ratingScores: scores as Prisma.InputJsonValue,
      ratingOverall: overall,
    },
  });
};

// IDs of the user's sessions that haven't been graded yet (newest first).
export const getUngradedSessionIds = async (
  userId: string,
): Promise<string[]> => {
  const rows = await prisma.session.findMany({
    where: { userId, ratingOverall: null },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => r.id);
};

// The user's graded sessions (scores only), for averaging.
export const getRatedSessions = async (userId: string) => {
  return prisma.session.findMany({
    where: { userId, ratingOverall: { not: null } },
    select: { ratingScores: true, ratingOverall: true },
  });
};
