"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff } from "lucide-react";
import CrisisModal from "@/app/UI/UserCallWindow/CrisisModal";
import { useUserCallWindow } from "@/app/hooks/useUserCallWindow";


interface UserCallWindowProps {
  sessionStarted: boolean;
  sessionId: string | null;
} 

const UserCallWindow = ({ sessionStarted, sessionId }: UserCallWindowProps) => {
  const { handleOnRecord, isConnected, isCrisis, dismissCrisis } =useUserCallWindow({ sessionId });

  return (
    <>
      {isCrisis && <CrisisModal onDismiss={dismissCrisis} />}

      <Card className="w-full max-w-md h-96 bg-green-600 border-none shadow-2xl overflow-hidden relative group mx-auto">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-10">
            <div className="w-full h-full bg-[radial-gradient(circle_at_20%_80%,_rgba(255,255,255,0.1)_0%,_transparent_50%)]"></div>
            <div className="w-full h-full bg-[radial-gradient(circle_at_80%_20%,_rgba(255,255,255,0.1)_0%,_transparent_50%)]"></div>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-green-700 bg-opacity-50 flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-white">AK</span>
          </div>
        </div>

        {/* WebSocket Status Indicator (optional) */}
        {isConnected && (
          <div className="absolute top-2 right-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white text-sm font-medium">
              Atharva Kurumbhatte
            </span>
          </div>

          {sessionStarted && !isCrisis ? (
            <Button onClick={handleOnRecord}>
              <Mic />
            </Button>
          ) : (
            <Button disabled>
              <MicOff />
            </Button>
          )}
        </div>
      </Card>
    </>
  );
};

export default UserCallWindow;
