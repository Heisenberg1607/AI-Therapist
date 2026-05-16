import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import router from "./Routes/Routes";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import { randomUUID } from "crypto";
import { verifyToken } from "./utils/jwtUtils";
import {
  createTurnStreamingTtsSession,
  type TurnStreamingTtsSession,
} from "./Service/ElevanLabsWebSocketStreaming";
import { AIgenerateResponse } from "./Service/Service";
import { createMessage } from "./Model/messageModel";
import { Sender } from "@prisma/client";
import { getMessagesBySession } from "./Model/messageModel";
import { logger } from "./utils/logger";
import { turnStore, newTurnId } from "./utils/turnContext";

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

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", router);
app.use("/audio", express.static(path.join(__dirname, "../audio")));

const httpServer = createServer(app);

type TurnSocketData = {
  activeTts?: TurnStreamingTtsSession;
  turnAbort?: AbortController;
};

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
  if (!token) return next(new Error("Authentication error"));
  try {
    const decoded = verifyToken(token);
    if (!decoded) return next(new Error("Invalid token"));
    socket.data.userId = decoded.userId;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  // Per-connection rate-limit state
  let msgCount = 0;
  let windowStart = Date.now();

  // Per-session turn tracking (populated on first sendMessage)
  socket.data.turnNumber = 0;
  socket.data.cumulativeTokens = 0;
  socket.data.turnLatencies = [] as number[];
  socket.data.socketConnectedAt = Date.now();
  socket.data.sessionId = null as string | null;

  logger.info(
    {
      layer: "runtime",
      event: "socket.connected",
      sessionId: "pending",
      turnId: "",
      socketId: socket.id,
      userId: socket.data.userId,
    },
    "Socket connected",
  );

  socket.on("sendMessage", async (data) => {
    const now = Date.now();

    // Rate limiting
    if (now - windowStart > 10000) {
      msgCount = 0;
      windowStart = now;
    }
    msgCount++;
    if (msgCount > 3) {
      socket.emit("audioError", {
        message: "Too many requests. Please wait for 10 seconds before sending another message.",
      });
      return;
    }

    socket.data.interrupted = false;
    const { sessionId, userResponse } = data as { sessionId: string; userResponse: string };
    const userId: string = socket.data.userId;

    // Track the sessionId on the socket for session.ended on disconnect
    if (!socket.data.sessionId) {
      socket.data.sessionId = sessionId;
    }

    const turnNumber: number = ++socket.data.turnNumber;
    const turnId = newTurnId();
    const turnStart = Date.now();

    const ctx = {
      sessionId,
      turnId,
      turnNumber,
      layer: "runtime" as const,
    };

    // Run all turn-scoped async work inside the AsyncLocalStorage context so
    // every nested call (Service, ElevenLabs, functionExecutors) can resolve
    // it via getCtx() without extra parameters.
    const turnAbort = new AbortController();
    (socket.data as TurnSocketData).turnAbort = turnAbort;

    const tts = createTurnStreamingTtsSession({
      onChunk: (chunk: Uint8Array) => {
        if (socket.data.interrupted) return;
        socket.emit("audioChunk", Buffer.from(chunk));
      },
      onComplete: (spokenText: string) => {
        if (socket.data.interrupted) return;
        socket.emit("audioComplete", { text: spokenText });
      },
      onError: (error: Error) => {
        logger.error(
          { ...ctx, layer: "runtime", event: "tts.error", err: error.message },
          "TTS stream error in turn",
        );
        socket.emit("audioError", { message: error.message });
      },
      isInterrupted: () => socket.data.interrupted,
    });
    (socket.data as TurnSocketData).activeTts = tts;

    try {
      await turnStore.run(ctx, async () => {
        // Layer 3 — Runtime: STT completed (browser WSR; durationMs not measurable server-side)
        logger.info(
          {
            ...ctx,
            event: "stt.final",
            durationMs: 0,
          },
          "STT final result received",
        );

        try {
          await createMessage(sessionId, Sender.USER, userResponse);

          socket.emit("aiThinking");
          const messages = await getMessagesBySession(sessionId);

          const { text: aiResponse, tokens } = await AIgenerateResponse(
            messages,
            userId,
            sessionId,
            () => socket.data.interrupted,
            tts,
            turnAbort.signal,
            () => socket.emit("crisisDetected"),
          );

          if (!aiResponse || socket.data.interrupted) {
            tts.abortTurn();
            return;
          }

          await createMessage(sessionId, Sender.AI, aiResponse);

          const pipelineMs = Date.now() - turnStart;
          socket.data.cumulativeTokens += tokens;
          socket.data.turnLatencies.push(pipelineMs);
          const latencies: number[] = socket.data.turnLatencies;
          const avgPipelineLatencyMs = Math.round(
            latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length,
          );

          logger.info(
            {
              ...ctx,
              layer: "runtime",
              event: "session.turn_completed",
              turnNumber,
              cumulativeTokens: socket.data.cumulativeTokens,
              pipelineLatencyMs: pipelineMs,
              avgPipelineLatencyMs,
            },
            "Turn completed",
          );
        } catch (error) {
          tts.abortTurn();
          logger.error(
            { ...ctx, layer: "runtime", event: "turn.error", err: error },
            "Unhandled error in turn",
          );
          socket.emit("audioError", {
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    } finally {
      delete (socket.data as TurnSocketData).activeTts;
      delete (socket.data as TurnSocketData).turnAbort;
    }
  });

  socket.on("interrupt", () => {
    socket.data.interrupted = true;
    (socket.data as TurnSocketData).turnAbort?.abort();
    (socket.data as TurnSocketData).activeTts?.abortTurn();
    logger.info(
      {
        layer: "runtime",
        event: "turn.interrupted",
        sessionId: socket.data.sessionId ?? "unknown",
        turnId: "",
        turnNumber: socket.data.turnNumber,
      },
      "Turn interrupted by client",
    );
  });

  socket.on("disconnect", () => {
    const sessionId: string = socket.data.sessionId ?? "unknown";
    const totalTurns: number = socket.data.turnNumber;
    const durationMs = Date.now() - socket.data.socketConnectedAt;

    // Layer 3 — Runtime: session ended
    logger.info(
      {
        layer: "runtime",
        event: "session.ended",
        sessionId,
        turnId: "",
        totalTurns,
        durationMs,
        totalTokens: socket.data.cumulativeTokens,
      },
      "Session ended",
    );
  });
});

httpServer.listen(PORT, () => {
  logger.info({ layer: "runtime", sessionId: "", turnId: "", event: "server.ready", port: PORT }, "Server ready");
});
