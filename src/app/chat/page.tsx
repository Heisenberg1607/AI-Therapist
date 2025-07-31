"use client";
import UserCallWindow from "../UI/UserCallWindow/UserCallWindow";
import AICallWindow from "../UI/AICallWindow/AICallWindow";
import StartSession from "../UI/StartSession/StartSession";
import {  useState } from "react";
import SubNavbar from "../UI/SubNavbar/SubNavbar";
import { CallContextProvider } from "@/app/context/callContext";

const Page = () => {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleStartSession = async () => {
    try {
      console.log("Attempting to start session..."); // Add logging
      const res = await fetch("http://localhost:5001/api/startSession", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to start session: ${res.status} ${errorText}`);
      }

      const data = await res.json();
      console.log("Session started successfully:", data); 
      setSessionId(data.sessionId);
      setSessionStarted(true);
      console.log("Session ID:", sessionId); 
    } catch (error) {
      console.error("Session start error:", error);
      // Add user feedback here
    }
  };

  

  return (
    <CallContextProvider>
      <div className="bg-black">
        <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 md:px-6">
          {/* SubNavbar on top and centered */}

          <SubNavbar></SubNavbar>
          {/* Cards container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl">
            {/* User Call Window */}
            <div className="flex justify-center items-center h-[420px]">
              <div className="w-full max-w-md">
                <UserCallWindow sessionStarted={sessionStarted} sessionId={sessionId} />
              </div>
            </div>

            {/* AI Call Window */}
            <div className="flex justify-center items-center h-[420px]">
              <div className="w-full max-w-md">
                {!sessionStarted ? (
                  <StartSession onStart={handleStartSession} />
                ) : (
                  <AICallWindow
                    onEnd={() => setSessionStarted(false)}
                    sessionStarted={sessionStarted}
                  />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </CallContextProvider>
  );
};

export default Page;
