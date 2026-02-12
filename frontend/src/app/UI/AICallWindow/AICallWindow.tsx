import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone } from 'lucide-react';
import React, {useEffect, useRef} from 'react'
import { useCallContext } from "@/app/context/callContext";

interface AICallWindowProps {
  onEnd: () => void;
  sessionStarted: boolean;
}

const AICallWindow: React.FC<AICallWindowProps> = ({ onEnd , sessionStarted}) => {

  const { text, isProcessing } = useCallContext();
  const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
      if (sessionStarted) {
        if (!audioRef.current) {
          console.log("session started", sessionStarted);
          audioRef.current = new Audio(
            "http://localhost:5001/audio/b2a0d62b-be91-430f-9846-f5d83a59788c.mp3"
          );
          audioRef.current
            .play()
            .then(() => {
              console.log("Welcome audio playing");
            })
            .catch((error) => {
              console.error("Audio playback failed:", error);
            });
        }
      } else {
        console.log("session ended", sessionStarted);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
      }
    }, [sessionStarted]);

    const handleEnd = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      onEnd();
    };

  console.log("AICallWindow text:", text);
  return (
    <div className="w-full h-full">
      <Card className="w-full max-w-md h-96 bg-green-600 border-none shadow-2xl overflow-hidden relative group">
        <div className="absolute inset-0 ">
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="w-full h-full bg-[radial-gradient(circle_at_20%_80%,_rgba(255,255,255,0.1)_0%,_transparent_50%)]"></div>
            <div className="w-full h-full bg-[radial-gradient(circle_at_80%_20%,_rgba(255,255,255,0.1)_0%,_transparent_50%)]"></div>
          </div>
        </div>

        {/* AI Avatar in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-green-700 bg-opacity-50 flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-white">AI</span>
          </div>
        </div>

        <div className="flex items-center justify-center h-16">
          <p
            className={`text-sm md:text-base text-white transition-all duration-300 ${
              isProcessing ? "text-red/80 animate-pulse" : "text-white/60"
            }`}
          >
            {isProcessing ? "Processing..." : "Waiting for input..."}
          </p>
        </div>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white text-sm font-medium"> AI</span>
          </div>

          <Button
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-4 px-8 rounded-full text-lg shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl"
            onClick={handleEnd}
          >
            <Phone className="w-5 h-5 rotate-[135deg]" />
          </Button>

          <div className="w-10 h-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          </div>
        </div>
      </Card>
      <div className="flex justify-center"></div>
    </div>
  );
}

export default AICallWindow
