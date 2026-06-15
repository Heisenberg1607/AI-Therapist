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

// A behavioral-health clinic (gov-sourced; rating/reviews/hours/website/email
// are NULL unless later enriched). `distanceM` is null when no location given.
export interface Clinic {
  id: string;
  name: string;
  npi: string | null;
  source: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  type: string | null;
  specialties: string[];
  description: string | null;
  lat: number | null;
  lng: number | null;
  accepting_patients: boolean | null;
  rating: number | null;
  reviews: number | null;
  hours: string | null;
  distanceM: number | null;
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

// One turn in a session's transcript. `sender` is USER (the client) or AI (the bot).
export interface ConversationMessage {
  id: string;
  sessionId: string;
  sender: "USER" | "AI";
  content: string;
  createdAt: string;
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

// Fetch the full message thread for one of the user's sessions (ownership-scoped
// server-side; returns [] if the session isn't found / not owned / unauthorized).
export const getSessionMessagesApi = async (
  sessionId: string,
): Promise<ConversationMessage[]> => {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/messages`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) removeToken();
    return [];
  }
  const data = await response.json();
  return Array.isArray(data.messages)
    ? (data.messages as ConversationMessage[])
    : [];
};

export interface ClinicsPage {
  clinics: Clinic[];
  total: number; // total matches across all pages
  page: number; // 1-based
  pageSize: number;
}

// Fetch one page of nearby clinics (server-side pagination). Public endpoint —
// pass lat/lng for distance ranking, or omit them for an alphabetical fallback.
export const getClinicsApi = async (params: {
  lat?: number;
  lng?: number;
  q?: string;
  specialty?: string;
  sort?: "distance" | "name";
  radius?: number;
  page?: number;
} = {}): Promise<ClinicsPage> => {
  const empty: ClinicsPage = {
    clinics: [],
    total: 0,
    page: params.page ?? 1,
    pageSize: 7,
  };

  const qs = new URLSearchParams();
  if (params.lat != null && params.lng != null) {
    qs.set("lat", String(params.lat));
    qs.set("lng", String(params.lng));
  }
  if (params.q) qs.set("q", params.q);
  if (params.specialty) qs.set("specialty", params.specialty);
  if (params.sort) qs.set("sort", params.sort);
  if (params.radius != null) qs.set("radius", String(params.radius));
  if (params.page != null) qs.set("page", String(params.page));

  const response = await fetch(`${API_BASE_URL}/clinics?${qs.toString()}`);
  if (!response.ok) return empty;
  const data = await response.json();
  return {
    clinics: Array.isArray(data.clinics) ? (data.clinics as Clinic[]) : [],
    total: typeof data.total === "number" ? data.total : 0,
    page: typeof data.page === "number" ? data.page : empty.page,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : 7,
  };
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
