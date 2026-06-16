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
  mood?: string;
  topic?: string;
  durationSec?: number;
};

// Update a session's summary/metadata, scoped to the owning user.
export const updateSessionSummary = async (
  sessionId: string,
  userId: string,
  data: SessionSummaryInput,
) => {
  const result = await prisma.session.updateMany({
    where: { id: sessionId, userId },
    data: {
      summary: data.summary,
      mood: data.mood,
      topic: data.topic,
      durationSec: data.durationSec,
    },
  });
  return result.count; // 0 if not found / not owned
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
