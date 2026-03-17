import { prisma } from "../prisma/prismaClient";
import bcrypt from "bcrypt";

export const createUser = async (name: string, email: string, password: string) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });
};

export const findUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

export const verifyPassword = async (
  plainPassword: string,
  hashedPassword: string,
) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};