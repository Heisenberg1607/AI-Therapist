"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "../lib/auth";

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCrisis, setIsCrisis] = useState(false); 
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected"> ("disconnected")

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setConnectionStatus("disconnected");
      setIsConnected(false);
      return
    }

    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, "");
    
    setConnectionStatus("connecting");
    setIsConnected(false);

    socketRef.current = io(wsUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
    });

    socketRef.current.on("connect", () => {
      console.log("✅ [WS] WebSocket connected, ID:", socketRef.current?.id);
      setIsConnected(true);
      setConnectionStatus("connected");
    });

    socketRef.current.on("disconnect", () => {
      console.log("❌ [WS] WebSocket disconnected");
      setIsConnected(false);
      setConnectionStatus("disconnected");
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("❌ [WS] Connection error:", error.message);
      setConnectionStatus("disconnected");
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

  return { socket: socketRef.current, isConnected, isCrisis, dismissCrisis, connectionStatus };
};
