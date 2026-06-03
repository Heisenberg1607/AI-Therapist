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

// Google OAuth support has been removed.

// Public-safe user fields (no password), including onboarding state.
export const getUserProfile = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      onboarded: true,
      onboardingData: true,
    },
  });
};

// Mark a user onboarded and store their onboarding answers.
export const setUserOnboarding = async (
  userId: string,
  onboardingData: unknown,
) => {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      onboarded: true,
      onboardingData: onboardingData as object,
    },
    select: {
      id: true,
      email: true,
      name: true,
      onboarded: true,
      onboardingData: true,
    },
  });
};

export const verifyPassword = async (
  plainPassword: string,
  hashedPassword: string,
) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};