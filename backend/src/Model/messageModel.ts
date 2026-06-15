import { prisma } from "../prisma/prismaClient";
import { Sender } from "@prisma/client";

export const createMessage = async (
  sessionId: string,
  sender: Sender,
  content: string
) => {
  return await prisma.message.create({
    data: {
      sessionId,
      sender,
      content,
    },
  });
};

export const getMessagesBySession = async (sessionId: string) => {
  return await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
};

// Messages for a session, but only if the session belongs to the user.
// Returns null when the session doesn't exist or isn't owned by the user
// (caller turns that into a 404 — keeps therapy transcripts private).
export const getMessagesForUserSession = async (
  sessionId: string,
  userId: string
) => {
  const owned = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!owned) return null;
  return getMessagesBySession(sessionId);
};
