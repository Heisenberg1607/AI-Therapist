import { prisma } from "../prisma/prismaClient";

export const createSession = async () => {
  return await prisma.session.create({
    data: {},
  });
};

export const getSessionById = async (sessionId: string) => {
  return await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: true },
  });
};
