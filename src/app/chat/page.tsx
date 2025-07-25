"use client";
import UserCallWindow from "../UI/UserCallWindow/UserCallWindow";
import AICallWindow from "../UI/AICallWindow/AICallWindow";
import StartSession from "../UI/StartSession/StartSession";
import { useState } from "react";
import SubNavbar from "../UI/SubNavbar/SubNavbar";
import { CallContextProvider } from "@/app/context/callContext";



const Page = () => {
  const [sessionStarted, setSessionStarted] = useState(false);

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
                <UserCallWindow sessionStarted={sessionStarted} />
              </div>
            </div>

            {/* AI Call Window */}
            <div className="flex justify-center items-center h-[420px]">
              <div className="w-full max-w-md">
                {!sessionStarted ? (
                  <StartSession onStart={() => setSessionStarted(true)} />
                ) : (
                    <AICallWindow onEnd={() => setSessionStarted(false)} sessionStarted={ sessionStarted} />
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
