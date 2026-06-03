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

type GoogleProfile = {
  googleId: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

// Find-or-create a user from a verified Google profile.
// Links Google to an existing local account when the email already exists.
export const upsertGoogleUser = async (profile: GoogleProfile) => {
  const select = {
    id: true,
    email: true,
    name: true,
    image: true,
    onboarded: true,
    onboardingData: true,
  } as const;

  // 1) Already linked via googleId.
  const existing = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
    select,
  });
  if (existing) return existing;

  // 2) Existing local account with the same email → link Google to it.
  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    return await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.googleId,
        image: byEmail.image ?? profile.image ?? null,
        provider: byEmail.provider ?? "google",
      },
      select,
    });
  }

  // 3) Brand-new Google user (no password).
  return await prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name ?? null,
      googleId: profile.googleId,
      image: profile.image ?? null,
      provider: "google",
    },
    select,
  });
};

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