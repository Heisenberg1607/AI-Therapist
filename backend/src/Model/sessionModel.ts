import { prisma } from "../prisma/prismaClient";

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
