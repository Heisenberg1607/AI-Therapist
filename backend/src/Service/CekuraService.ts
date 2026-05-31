import axios from "axios";
import { logger } from "../utils/logger";
import { getMessagesBySession } from "../Model/messageModel";
import { Sender } from "@prisma/client";

const CEKURA_API_URL = "https://api.cekura.ai/observability/v1/observe/";
const CEKURA_API_KEY = process.env.CEKURA_API_KEY || "";
const CEKURA_AGENT_ID = process.env.CEKURA_AGENT_ID || "therapist-bot";

interface CekuraMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface CekuraPayload {
  agent_id: string;
  run_id: string;
  transcript_type: string;
  transcript_json: CekuraMessage[];
  startedAt: string;
  endedAt: string;
}

export const sendTranscriptToCekura = async (
  sessionId: string,
  startedAt: Date,
  endedAt: Date
): Promise<boolean> => {
  try {
    if (!CEKURA_API_KEY) {
      logger.warn(
        { sessionId, layer: "cekura" },
        "Cekura API key not configured, skipping transcript evaluation"
      );
      return false;
    }

    logger.info(
      { sessionId, layer: "cekura", event: "transcript.fetch" },
      "Fetching messages for Cekura"
    );

    const messages = await getMessagesBySession(sessionId);

    if (!messages || messages.length === 0) {
      logger.warn(
        { sessionId, layer: "cekura" },
        "No messages found for session, skipping Cekura submission"
      );
      return false;
    }

    const cekuraMessages: CekuraMessage[] = messages.map((msg) => ({
      role: msg.sender === Sender.USER ? "user" : "assistant",
      content: msg.content,
      timestamp: msg.createdAt.toISOString(),
    }));

    const payload: CekuraPayload = {
      agent_id: CEKURA_AGENT_ID,
      run_id: sessionId,
      transcript_type: "pipecat",
      transcript_json: cekuraMessages,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    };

    logger.info(
      { sessionId, layer: "cekura", event: "transcript.send", messageCount: messages.length },
      "Sending transcript to Cekura"
    );

    const response = await axios.post(CEKURA_API_URL, payload, {
      headers: {
        "X-CEKURA-API-KEY": CEKURA_API_KEY,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    logger.info(
      { sessionId, layer: "cekura", event: "transcript.success", status: response.status },
      "Transcript successfully sent to Cekura for evaluation"
    );

    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        {
          sessionId,
          layer: "cekura",
          event: "transcript.error",
          status: error.response?.status,
          message: error.message,
        },
        "Failed to send transcript to Cekura"
      );
    } else {
      logger.error(
        { sessionId, layer: "cekura", event: "transcript.error", error },
        "Unexpected error sending transcript to Cekura"
      );
    }
    return false;
  }
};
