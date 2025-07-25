import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic } from "lucide-react";
import React from "react";

import { useCallContext } from "@/app/context/callContext";

const UserCallWindow = () => {
  // const [text, setText] = useState("");
  const { setText, setIsProcessing } = useCallContext();

  const handleOnRecord = () => {
    console.log("Recording started");

    const speechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!speechRecognition) {
      console.error("SpeechRecognition API is not supported in this browser.");
      return;
    } else {
      console.log("SpeechRecognition API is supported.");
    }
    const recognition = new speechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = async function (event) {
      const result = event.results[event.resultIndex];

      if (!result.isFinal) return; // Wait for final result only

      const transcript = result[0].transcript.trim();
      console.log("Transcript is this brooooo", transcript);

      if (transcript) {
        setText(transcript);
        console.log("Sending transcript to API:", transcript);
        await sendTranscriptToAPI(transcript);
        console.log("Transcript sent to API successfully");
      } else {
        console.log("Transcript was empty or whitespace only.");
      }
    };

    // console.log(text);

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    recognition.start();
  };

  const sendTranscriptToAPI = async (transcript: string) => {
   setIsProcessing(true);
   if (!transcript.trim()) return;

   try {
     const response = await fetch("http://localhost:5001/api/getResponse", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         Accept: "application/json",
       },
       body: JSON.stringify({ userResponse: transcript }),
     });

     if (!response.ok) {
       const errorBody = await response.text();
       throw new Error(
         `HTTP error! status: ${response.status}, body: ${errorBody}`
       );
     }

     const data = await response.json();
     setText(data.audio); // Set AI's response
     setIsProcessing(false);
     console.log("🎧 AI Response:", data);

     const audio = new Audio(data.audio);
     audio.play();
   } catch (error) {
     console.error("❌ Failed to send transcript:", error);
     setIsProcessing(false);
   }
 };

  return (
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

      <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
        <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-3 py-1">
          <span className="text-white text-sm font-medium">
            Atharva Kurumbhatte
          </span>
        </div>

        <Button
          size="sm"
          className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm border-none rounded-full w-10 h-10 p-0"
          onClick={handleOnRecord}
        >
          <Mic className="w-4 h-4 text-white" />
        </Button>
      </div>
    </Card>
  );
};

export default UserCallWindow;
