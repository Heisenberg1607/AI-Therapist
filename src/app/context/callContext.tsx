"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

interface CallContextType {
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  audioUrl: string;
  setAudioUrl: React.Dispatch<React.SetStateAction<string>>;
}

const CallContext = createContext<CallContextType | null>(null);

interface CallContextProviderProps {
  children: ReactNode; // ✅ Properly typed children
}

export const CallContextProvider = ({ children }: CallContextProviderProps) => {
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");

  return (
    <CallContext.Provider
      value={{ text, setText, isProcessing, setIsProcessing, audioUrl, setAudioUrl }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context)
    throw new Error("useCallContext must be used within CallContextProvider");
  return context;
};
