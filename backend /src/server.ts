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

const app = express();
const PORT = process.env.PORT || 5001;

// Existing middleware
app.use(cors());
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
    origin: "http://localhost:3000",
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
  console.log("Client connected:", socket.id, "User:", socket.data.userId);

  socket.on("sendMessage", async (data) => {
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
      const aiResponse = await AIgenerateResponse(userResponse);
      console.log(
        "✅ [AI] Response generated:",
        aiResponse.substring(0, 100) + "...",
      );

      // Save AI response
      console.log("💾 [DB] Saving AI message...");
      await createMessage(sessionId, Sender.AI, aiResponse);
      console.log("✅ [DB] AI message saved");

      // Stream audio back to client
      console.log("🎵 [ELEVENLABS] Starting audio stream...");
      await streamSpeechWithElevenLabs(
        aiResponse,
        (chunk: Uint8Array) => {
          console.log(`📦 [AUDIO] Sending chunk: ${chunk.length} bytes`);
          // Convert Uint8Array to Buffer for Socket.IO binary transport
          socket.emit("audioChunk", Buffer.from(chunk));
        },
        () => {
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
});

// Start server (use httpServer instead of app)
httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
