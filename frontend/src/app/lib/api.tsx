import { getAuthHeaders, removeToken } from "./auth";
import type { OnboardingAnswers } from "@/lib/buildSystemPrompt";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string | null;
  onboarded?: boolean;
  onboardingData?: OnboardingAnswers | null;
}

export interface DbSession {
  id: string;
  createdAt: string;
  summary: string | null;
  mood: string | null;
  topic: string | null;
  durationSec: number | null;
  crisisFlag: boolean;
}

interface LoginResponse {
  message: string;
  user: AuthUser;
  token: string;
}

interface RegisterResponse {
  message: string;
  user: {
    id: string;
    email: string;
    name?: string;
    createdAt: string;
  };
  token: string;
}

interface SessionResponse {
  sessionId: string;
}

interface MessageResponse {
  audio: string;
}

// Auth APIs
export const login = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Login failed");
  }

  return response.json();
};

export const googleAuth = async (
  credential: string,
): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Google sign-in failed");
  }

  return response.json();
};

export const register = async (
  name: string,
  email: string,
  password: string,
): Promise<RegisterResponse> => {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Registration failed");
  }

  return response.json();
};

export const logout = (): void => {
  removeToken();
  // Optionally: call backend logout endpoint if you implement one
};

// Protected APIs (require authentication)
export const startSession = async (): Promise<SessionResponse> => {
  const response = await fetch(`${API_BASE_URL}/startSession`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      removeToken();
      throw new Error("Session expired. Please login again.");
    }
    const error = await response.json();
    throw new Error(error.message || "Failed to start session");
  }

  return response.json();
};

export const sendMessage = async (
  sessionId: string,
  userResponse: string,
): Promise<MessageResponse> => {
  const response = await fetch(`${API_BASE_URL}/getResponse`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ sessionId, userResponse }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      removeToken();
      throw new Error("Session expired. Please login again.");
    }
    const error = await response.json();
    throw new Error(error.message || "Failed to send message");
  }

  return response.json();
};

// Fetch the current user (incl. onboarding state). Returns null if unauthorized.
export const getMe = async (): Promise<AuthUser | null> => {
  const response = await fetch(`${API_BASE_URL}/me`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) removeToken();
    return null;
  }
  const data = await response.json();
  return data.user as AuthUser;
};

// Persist onboarding answers + flag for the user.
export const completeOnboarding = async (
  answers: OnboardingAnswers,
): Promise<AuthUser | null> => {
  const response = await fetch(`${API_BASE_URL}/onboarding`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.user as AuthUser;
};

// Save a session's summary + metadata to the DB.
export const saveSessionSummary = async (
  sessionId: string,
  payload: { summary: string; mood: string; topic: string; durationSec: number },
): Promise<void> => {
  await fetch(`${API_BASE_URL}/sessions/${sessionId}/summary`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
};

// Fetch all past sessions for the dashboard.
export const getSessionsApi = async (): Promise<DbSession[]> => {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.sessions) ? (data.sessions as DbSession[]) : [];
};

// export const getWelcomeMessage = async (): Promise<{
//   message: string;
//   audio: string;
// }> => {
//   const response = await fetch(`${API_BASE_URL}/welcomeMessage`, {
//     headers: getAuthHeaders(),
//   });

//   if (!response.ok) {
//     if (response.status === 401) {
//       removeToken();
//       throw new Error("Session expired. Please login again.");
//     }
//     const error = await response.json();
//     throw new Error(error.message || "Failed to get welcome message");
//   }

//   return response.json();
// };
