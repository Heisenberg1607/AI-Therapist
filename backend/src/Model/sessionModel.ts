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
