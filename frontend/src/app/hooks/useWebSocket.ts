"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "../lib/auth";

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCrisis, setIsCrisis] = useState(false); 

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    socketRef.current = io("http://localhost:5001", {
      auth: { token },
    });

    socketRef.current.on("connect", () => {
      console.log("✅ [WS] WebSocket connected, ID:", socketRef.current?.id);
      setIsConnected(true);
    });

    socketRef.current.on("disconnect", () => {
      console.log("❌ [WS] WebSocket disconnected");
      setIsConnected(false);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("❌ [WS] Connection error:", error.message);
    });

    socketRef.current.on("crisisDetected", () => {
      // ← ADD THIS
      console.log("🚨 [WS] Crisis detected", isCrisis);
      setIsCrisis(true);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);
  const dismissCrisis = () => setIsCrisis(false);

  return { socket: socketRef.current, isConnected, isCrisis, dismissCrisis };
};
