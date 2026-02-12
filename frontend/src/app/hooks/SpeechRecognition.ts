import { useState, useRef, useEffect } from "react";
import {
  CustomSpeechRecognition,
  CustomSpeechRecognitionEvent,
} from "@/app/types/speechRecognition";

interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  silenceTimeout?: number;
}

interface UseSpeechRecognitionReturn {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn => {
  const {
    continuous = true,
    interimResults = true,
    lang = "en-US",
    silenceTimeout = 4000,
  } = options;

  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if speech recognition is supported
  const isSupported = !!(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    if (recognitionRef.current && isListening) {
      inactivityTimerRef.current = setTimeout(() => {
        stopListening();
        console.log(
          `Stopped due to ${silenceTimeout / 1000} seconds of silence`
        );
      }, silenceTimeout);
    }
  };

  const startListening = () => {
    if (!isSupported) {
      setError("Speech Recognition is not supported in this browser.");
      return;
    }

    if (isListening) return;

    const SpeechRecognitionConstructor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    const recognition: CustomSpeechRecognition =
      new SpeechRecognitionConstructor();

    recognitionRef.current = recognition;

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onresult = (event: CustomSpeechRecognitionEvent) => {
      resetInactivityTimer(); // Reset timer on speech

      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPiece = result[0].transcript;

        if (result.isFinal) {
          setTranscript((prev) => prev + transcriptPiece + " ");
        } else {
          interimTranscript += transcriptPiece;
          console.log("Interim:", interimTranscript);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("Recognition ended.");
      setIsListening(false);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };

    try {
      recognition.start();
      setIsListening(true);
      setError(null);
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setError("Failed to start speech recognition");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    setIsListening(false);
  };

  const resetTranscript = () => {
    setTranscript("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  return {
    transcript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
};
