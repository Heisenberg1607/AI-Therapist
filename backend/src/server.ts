import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import router from "./Routes/Routes";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "./utils/jwtUtils";
import { streamSpeechWithElevenLabs } from "./Service/ElevanLabsWebSocketStreaming";
import { AIgenerateResponse } from "./Service/Service";
import { createMessage } from "./Model/messageModel";
import { Sender } from "@prisma/client";
import { getMessagesBySession } from "./Model/messageModel";

const app = express();
const PORT = process.env.PORT || 5001;



const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      "http://localhost:3000",
      "http://localhost:3001",
      FRONTEND_URL,
    ].filter(Boolean);
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};

// Existing middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Existing HTTP routes (KEEP THESE!)
app.use("/api", router);
app.use("/audio", express.static(path.join(__dirname, "../audio")));

// Create HTTP server from Express app
const httpServer = createServer(app);

// Add Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      const allowed = [
        "http://localhost:3000",
        "http://localhost:3001",
        FRONTEND_URL,
      ].filter(Boolean);
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// WebSocket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error"));
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new Error("Invalid token"));
    }
    socket.data.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error("Invalid token"));
  }
});

// WebSocket event handlers
io.on("connection", (socket) => {

  let msgCount = 0;
  let windowStart = Date.now();

  
  console.log("Client connected:", socket.id, "User:", socket.data.userId);

  socket.on("sendMessage", async (data) => {
    
    const now = Date.now();

    if (now - windowStart > 10000) {
      msgCount = 0;
      windowStart = now;
    }

    msgCount++;

    if (msgCount > 3) {
      socket.emit("audioError", {
        message: "Too many requests. Please wait for 10 seconds before sending another message."
      })
      return;
    }
    socket.data.interrupted = false;
    const { sessionId, userResponse } = data;
    const userId = socket.data.userId;

    console.log("🎯 [SOCKET] Received message:", {
      socketId: socket.id,
      userId,
      sessionId,
      userResponse,
    });

    try {
      // Save user message
      console.log("💾 [DB] Saving user message...");
      await createMessage(sessionId, Sender.USER, userResponse);
      console.log("✅ [DB] User message saved");

      // Generate AI response text
      console.log("🤖 [AI] Generating response...");
      socket.emit("aiThinking");
      const messages = await getMessagesBySession(sessionId);
      
      const aiResponse = await AIgenerateResponse(messages, userId, sessionId, () => socket.data.interrupted , () => socket.emit("crisisDetected"));
      console.log(
        "✅ [AI] Response generated:",
        aiResponse.substring(0, 100) + "...",
      );
      if (!aiResponse || socket.data.interrupted) {
        return;
      }

      // Save AI response
      console.log("💾 [DB] Saving AI message...");
      await createMessage(sessionId, Sender.AI, aiResponse);
      console.log("✅ [DB] AI message saved");

      // Stream audio back to client
      console.log("🎵 [ELEVENLABS] Starting audio stream...");
      await streamSpeechWithElevenLabs(
        aiResponse,
        (chunk: Uint8Array) => {
          if (socket.data.interrupted) return; // ← add this check
          console.log(`📦 [AUDIO] Sending chunk: ${chunk.length} bytes`);
          socket.emit("audioChunk", Buffer.from(chunk));
        },
        () => {
          if (socket.data.interrupted) return; // ← add this check
          console.log("✅ [AUDIO] Stream complete");
          socket.emit("audioComplete", { text: aiResponse });
        },
        (error: Error) => {
          console.error("❌ [AUDIO] Stream error:", error.message);
          socket.emit("audioError", { message: error.message });
        },
      );
    } catch (error) {
      console.error("❌ [SOCKET] WebSocket message error:", error);
      socket.emit("audioError", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

  socket.on("interrupt", () => {
    console.log("🛑 [SOCKET] Interrupt received");
    socket.data.interrupted = true;
  });

  
});

// Start server (use httpServer instead of app)
httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
