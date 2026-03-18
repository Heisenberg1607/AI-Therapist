import { getAuthHeaders, removeToken } from "./auth";

const API_BASE_URL = "http://localhost:5001/api";

interface LoginResponse {
  message: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
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

export const getWelcomeMessage = async (): Promise<{
  message: string;
  audio: string;
}> => {
  const response = await fetch(`${API_BASE_URL}/welcomeMessage`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      removeToken();
      throw new Error("Session expired. Please login again.");
    }
    const error = await response.json();
    throw new Error(error.message || "Failed to get welcome message");
  }

  return response.json();
};
