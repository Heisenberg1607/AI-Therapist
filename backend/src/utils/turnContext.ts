import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

export type Layer = "guardrails" | "ai_gateway" | "runtime";

export interface TurnContext {
  sessionId: string;
  turnId: string;
  turnNumber: number;
  layer: Layer;
}

/**
 * AsyncLocalStorage store that propagates turn context (sessionId, turnId,
 * turnNumber) across the entire async call chain for a single turn without
 * threading extra parameters through every function signature.
 *
 * Usage:
 *   turnStore.run(ctx, async () => { ... all async work for this turn ... })
 *
 * Inside any nested async call:
 *   const ctx = getCtx();
 */
export const turnStore = new AsyncLocalStorage<TurnContext>();

/** Returns the current turn context or a safe fallback outside a turn. */
export const getCtx = (): TurnContext =>
  turnStore.getStore() ?? {
    sessionId: "unknown",
    turnId: "unknown",
    turnNumber: 0,
    layer: "runtime",
  };

export const newTurnId = (): string => randomUUID();
