"use client";
import UserCallWindow from "../UI/UserCallWindow/UserCallWindow";
import AICallWindow from "../UI/AICallWindow/AICallWindow";
import StartSession from "../UI/StartSession/StartSession";
import { useState } from "react";
import SubNavbar from "../UI/SubNavbar/SubNavbar";
import { CallContextProvider } from "@/app/context/callContext";
import { ProtectedRoute } from "../Components/ProtectedRoute";
import { startSession , resumeSession} from "../lib/api";
import { useAuth } from "../context/authContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SessionMessage = {
  id: string;
  content: string;
};

const Page = () => {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumeSessionID, setResumeSessionID] = useState<string>("");
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const { user } = useAuth();

  const handleStartSession = async () => {
    try {
      setError(null);
      console.log("Attempting to start session for user:", user?.email);
      
      const data = await startSession();
      
      console.log("Session started successfully:", data);
      setSessionId(data.sessionId);
      setSessionStarted(true);
    } catch (error) {
      console.error("Session start error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start session";
      setError(errorMessage);
      
      // If token expired, user will be redirected to login by ProtectedRoute
      if (errorMessage.includes("Session expired")) {
        // The error handling in api.tsx will handle token removal
        // ProtectedRoute will redirect to login
      }
    }
  };

  const handleResumeSession = async () => {
    const id = resumeSessionID?.trim();
    if (!id) {
      setError("Session ID is required");
      return;
    }
    try {
      
      const data = await resumeSession(id);
      console.log("Session resumed successfully", data); 
      setResumeSessionID(data.sessionId);
      setSessionId(data.sessionId);
      setSessionStarted(true);
      setResumeSessionID("");
      setMessages(data.messages);
    } catch (error) {
      console.log("session resume error", error);
    }
  } 

  return (
    <ProtectedRoute>
      <CallContextProvider>
        <div className="bg-black">
          <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 md:px-6">
            {/* SubNavbar on top and centered */}
            <SubNavbar />

            {/* Error display */}
            {error && (
              <div className="w-full max-w-6xl mb-4 bg-red-500 text-white px-4 py-3 rounded">
                {error}
              </div>
            )}

            {!sessionStarted && (
              <div>
                <Input
                  value={resumeSessionID}
                  onChange={(e) => setResumeSessionID(e.target.value)}
                  className="text-white"
                />
                <Button onClick={handleResumeSession} className="text-white">
                  Join Session
                </Button>
              </div>
            )}

            {/* Cards container */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl">
              {/* User Call Window */}
              <div className="flex justify-center items-center h-[420px]">
                <div className="w-full max-w-md">
                  <UserCallWindow
                    sessionStarted={sessionStarted}
                    sessionId={sessionId}
                  />
                </div>
              </div>

              {/* AI Call Window */}
              <div className="flex justify-center items-center h-[420px]">
                <div className="w-full max-w-md">
                  {!sessionStarted ? (
                    <StartSession onStart={handleStartSession} />
                  ) : (
                    <AICallWindow
                      onEnd={() => {
                        setSessionStarted(false);
                        setSessionId(null);
                      }}
                      sessionStarted={sessionStarted}
                    />
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
        {messages.length > 0 && (
          <ul>
            {messages.map((msg, idx) => (
              <li key={msg?.id ?? idx}>{msg.content}</li>
            ))}
          </ul>
        )}
      </CallContextProvider>
    </ProtectedRoute>
  );
};

export default Page;
