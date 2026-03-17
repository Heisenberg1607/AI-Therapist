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
