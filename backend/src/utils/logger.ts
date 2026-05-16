import pino from "pino";

const lokiUsername = process.env.GRAFANA_LOKI_USERNAME;
const lokiApiKey = process.env.GRAFANA_LOKI_API_KEY;
const lokiHost = "https://logs-prod-021.grafana.net";

const prettyTarget = {
  target: "pino-pretty",
  options: {
    colorize: true,
    translateTime: "SYS:HH:MM:ss.l",
    ignore: "pid,hostname",
    messageKey: "msg",
    customPrettifiers: {},
  },
};

const lokiTarget = {
  target: "pino-loki",
  options: {
    host: lokiHost,
    basicAuth: {
      username: lokiUsername ?? "",
      password: lokiApiKey ?? "",
    },
    labels: { app: "ai-therapist", env: process.env.NODE_ENV ?? "development" },
    batching: { interval: 5 },
    replaceTimestamp: true,
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTarget = any;

const transport = lokiUsername && lokiApiKey
  ? pino.transport({ targets: [prettyTarget, lokiTarget] as AnyTarget[] })
  : pino.transport(prettyTarget);

/**
 * Shared structured logger.
 *
 * Always pretty-prints to terminal via pino-pretty.
 * Also ships to Grafana Loki when GRAFANA_LOKI_USERNAME and GRAFANA_LOKI_API_KEY are set.
 *
 * messageKey is "msg" so the "message" data field (e.g. DB content) can be
 * safely redacted without touching the human-readable log string.
 *
 * Redacted paths cover the fields that may carry user speech or PII.
 * They are replaced with "[REDACTED]" at serialisation time — the raw
 * value never reaches any transport.
 */
export const logger = pino(
  {
    messageKey: "msg",
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        // Top-level fields
        "transcript",
        "userSpeech",
        "content",
        "message",
        // One level deep (e.g. inside a nested data object)
        "*.transcript",
        "*.userSpeech",
        "*.content",
        "*.message",
      ],
      censor: "[REDACTED]",
    },
    // Remove pid/hostname — not useful in this context
    base: undefined,
  },
  transport,
);
