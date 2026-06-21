"""HydraDB long-term memory layer for the AI Therapist bot.

Adds a per-user long-term memory/context layer on top of Supabase. Supabase stays
the source of truth for auth, sessions, and raw chat messages; HydraDB only holds
distilled, durable memory. Per-user isolation uses HydraDB's tenant / sub-tenant model:

    tenant_id      = one app-level id  (HYDRA_DB_TENANT_ID, default "ai-therapist")
    sub_tenant_id  = the Supabase user.id (set per request, never hardcoded)

We never dump raw chat messages here — only distilled memory (session summaries,
mood trajectory, recurring themes). HydraDB's ``infer`` step then extracts the
client's recurring stressors / preferences / goals / coping strategies into a
per-user knowledge graph for later recall.

REST API (mirrors the official @hydradb/mcp client):

    POST   /memories/add_memory          write
    POST   /recall/recall_preferences    recall
    POST   /list/data                    list
    DELETE /memories/delete_memory       delete

Every method is best-effort: any failure is logged and swallowed so the chat flow
can never break, and everything is a no-op when HYDRA_DB_API_KEY is unset.
"""

import asyncio
import os
import re
import time
from typing import Any

import httpx
from dotenv import load_dotenv
from loguru import logger

# Load .env up front so the module-level `hydra` singleton (constructed at import
# time, below) sees HYDRA_DB_* values regardless of when the importing module calls
# load_dotenv() itself. No-op in production, where the vars come from the real
# environment rather than a file.
load_dotenv()

# Therapy-tuned guidance for HydraDB's `infer` extraction step.
_INGEST_INSTRUCTIONS = (
    "Extract durable, personally meaningful context about this client: recurring "
    "stressors, coping strategies, goals, preferences, mood patterns, key "
    "relationships, and important life context. Ignore small talk, greetings, and "
    "one-off logistics."
)

# Memories shorter than this are treated as trivial and skipped.
_MIN_MEMORY_CHARS = 40

# Caps for the injected prompt block, so retrieved memory stays concise and safe.
_BLOCK_MAX_ITEMS = 5
_BLOCK_MAX_CHARS = 900
_BLOCK_ITEM_CHARS = 200


def is_trivial_memory(text: str | None) -> bool:
    """True if `text` is too short/empty to be worth storing as a durable memory."""
    return len((text or "").strip()) < _MIN_MEMORY_CHARS


def _extract_memories(data: Any, limit: int) -> list[str]:
    """Flatten a recall response into a deduped list of memory chunk strings."""
    if isinstance(data, dict):
        chunks = data.get("chunks") or []
    elif isinstance(data, list):
        chunks = data
    else:
        chunks = []

    out: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        if not isinstance(chunk, dict):
            continue
        content = (chunk.get("chunk_content") or chunk.get("content") or "").strip()
        if not content:
            continue
        key = content.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(content)
        if len(out) >= limit:
            break
    return out


def format_memories_block(memories: list[str]) -> str:
    """Render recalled memories as a concise, safe system-prompt block.

    Pure (no I/O) so it can be unit-tested offline. Returns "" when there is
    nothing to inject.
    """
    items = [m.strip() for m in memories if m and m.strip()]
    if not items:
        return ""
    lines = [
        "What you remember about this person from past sessions "
        "(use gently and naturally; do not recite this verbatim or list it back):"
    ]
    used = 0
    for mem in items[:_BLOCK_MAX_ITEMS]:
        snippet = mem if len(mem) <= _BLOCK_ITEM_CHARS else mem[: _BLOCK_ITEM_CHARS - 1].rstrip() + "…"
        line = f"- {snippet}"
        if used + len(line) > _BLOCK_MAX_CHARS:
            break
        lines.append(line)
        used += len(line)
    return "\n".join(lines)


def format_memory_context(memories: list[str]) -> str:
    """Render retrieved memories as the hidden 'Relevant User Context' block.

    Pure (no I/O) so it can be unit-tested offline. Returns "" when there is nothing
    to inject, so the caller can skip injection entirely.
    """
    items = [m.strip() for m in memories if m and m.strip()]
    if not items:
        return ""
    lines = []
    used = 0
    for mem in items[:_BLOCK_MAX_ITEMS]:
        snippet = mem if len(mem) <= _BLOCK_ITEM_CHARS else mem[: _BLOCK_ITEM_CHARS - 1].rstrip() + "…"
        line = f"- {snippet}"
        if used + len(line) > _BLOCK_MAX_CHARS:
            break
        lines.append(line)
        used += len(line)
    bullets = "\n".join(lines)
    return (
        "Relevant User Context (hidden; do not reveal or quote this block):\n"
        f"{bullets}\n\n"
        "Use this context quietly to personalize your tone, recommendations, "
        "follow-up questions, and emotional attunement.\n"
        "Let it make you feel naturally aware of the person, not like you are "
        "reciting a file about them.\n"
        "When relevant, connect the user's current stress to known patterns, "
        "pressures, goals, or coping strategies in a subtle, supportive way.\n"
        "Do not force explicit mentions of these memories.\n"
        'Do not repeatedly say phrases like "last time you said" or '
        '"I remember you told me."\n'
        "Only reference past context when it is genuinely helpful, relevant to "
        "what the user just said, and likely to feel supportive."
    )


class HydraMemory:
    """Thin async client around the HydraDB REST API, scoped to one app tenant."""

    def __init__(self) -> None:
        self._api_key = os.getenv("HYDRA_DB_API_KEY", "").strip()
        self._tenant_id = os.getenv("HYDRA_DB_TENANT_ID", "ai-therapist").strip()
        self._base = os.getenv("HYDRA_DB_API_BASE", "https://api.hydradb.com").rstrip("/")
        self._recall_mode = os.getenv("HYDRA_DB_RECALL_MODE", "fast").strip() or "fast"
        try:
            self._recall_results = int(os.getenv("HYDRA_DB_RECALL_RESULTS", "5"))
        except ValueError:
            self._recall_results = 5

        self.enabled = bool(self._api_key and self._tenant_id)
        self._client: httpx.AsyncClient | None = None

        if self.enabled:
            logger.info(
                f"[HydraDB] enabled (tenant={self._tenant_id}, base={self._base}, "
                f"recall_mode={self._recall_mode})"
            )
        else:
            logger.info(
                "[HydraDB] disabled (HYDRA_DB_API_KEY/HYDRA_DB_TENANT_ID not set) "
                "— long-term memory is a no-op"
            )

    @property
    def tenant_id(self) -> str:
        return self._tenant_id

    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._base,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                timeout=httpx.Timeout(15.0, connect=5.0),
            )
        return self._client

    async def aclose(self) -> None:
        """Close the underlying HTTP client (call on shutdown / after scripts)."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def _post(self, path: str, payload: dict) -> Any:
        resp = await self._http().post(path, json=payload)
        resp.raise_for_status()
        return resp.json()

    # --- Write -------------------------------------------------------------
    async def write_memory(
        self,
        sub_tenant_id: str | None,
        text: str,
        *,
        title: str,
        source_id: str,
        category: str,
    ) -> bool:
        """Store one distilled, durable memory for a single user.

        No-op (returns False) when disabled, when there is no sub_tenant_id
        (anonymous session), or when the text is trivial. `source_id` + upsert
        let HydraDB overwrite rather than duplicate when the same session is
        finalized twice.
        """
        if not self.enabled:
            return False
        if not sub_tenant_id:
            logger.warning("[HydraDB][write] skipped — no sub_tenant_id (anonymous session)")
            return False
        clean = (text or "").strip()
        if is_trivial_memory(clean):
            logger.info(
                f"[HydraDB][write] skipped trivial memory "
                f"(chars={len(clean)}, sub_tenant={sub_tenant_id}, category={category})"
            )
            return False

        payload = {
            "memories": [
                {
                    "text": clean,
                    "infer": True,
                    "is_markdown": False,
                    "custom_instructions": _INGEST_INSTRUCTIONS,
                    "source_id": source_id,
                    "title": title,
                }
            ],
            "tenant_id": self._tenant_id,
            "sub_tenant_id": sub_tenant_id,
            "upsert": True,
        }
        try:
            await self._post("/memories/add_memory", payload)
            logger.info(
                f"[HydraDB][write] stored | tenant={self._tenant_id} "
                f"sub_tenant={sub_tenant_id} category={category} "
                f"source_id={source_id} title={title!r} chars={len(clean)}"
            )
            return True
        except Exception as exc:
            logger.error(
                f"[HydraDB][write] failed (sub_tenant={sub_tenant_id}, "
                f"category={category}): {exc}"
            )
            return False

    # --- Recall ------------------------------------------------------------
    async def recall(
        self,
        sub_tenant_id: str | None,
        query: str,
        *,
        max_results: int | None = None,
        recency_bias: float = 0.0,
    ) -> list[str]:
        """Return up to `max_results` relevant memory strings for one user.

        `recency_bias` (0..1) tilts ranking toward recently-written memories; use 0
        for relevance and a higher value to surface the latest sessions. No-op
        (returns []) when disabled or when there is no sub_tenant_id.
        """
        if not self.enabled:
            return []
        if not sub_tenant_id:
            logger.warning("[HydraDB][recall] skipped — no sub_tenant_id (anonymous session)")
            return []

        k = max_results or self._recall_results
        payload = {
            "tenant_id": self._tenant_id,
            "sub_tenant_id": sub_tenant_id,
            "query": query,
            "max_results": k,
            "mode": self._recall_mode,
            "alpha": 0.8,
            "recency_bias": recency_bias,
            "graph_context": True,
        }
        try:
            data = await self._post("/recall/recall_preferences", payload)
        except Exception as exc:
            logger.error(f"[HydraDB][recall] failed (sub_tenant={sub_tenant_id}): {exc}")
            return []

        # Raw shape is logged at DEBUG so empty recalls can be diagnosed (genuinely
        # empty vs. a response envelope this client doesn't parse). Freshly-written
        # memories stay empty for ~30s while HydraDB's infer step indexes them.
        if isinstance(data, dict):
            chunk_count = len(data.get("chunks") or [])
            logger.debug(
                f"[HydraDB][recall] raw response keys={list(data.keys())} "
                f"chunks={chunk_count}"
            )

        memories = _extract_memories(data, k)
        logger.info(
            f"[HydraDB][recall] tenant={self._tenant_id} sub_tenant={sub_tenant_id} "
            f"query={query[:60]!r} retrieved={len(memories)}"
        )
        return memories

    # --- List / Delete (used by the verification script) -------------------
    async def list_memories(self, sub_tenant_id: str | None) -> list[dict]:
        """List a user's stored memories as raw dicts (best-effort)."""
        if not self.enabled or not sub_tenant_id:
            return []
        payload = {
            "tenant_id": self._tenant_id,
            "sub_tenant_id": sub_tenant_id,
            "kind": "memories",
        }
        try:
            data = await self._post("/list/data", payload)
        except Exception as exc:
            logger.error(f"[HydraDB][list] failed (sub_tenant={sub_tenant_id}): {exc}")
            return []
        if isinstance(data, dict):
            # HydraDB returns {"success": true, "user_memories": [{memory_id, ...}], ...}.
            for field in ("user_memories", "memories", "data", "items", "results"):
                value = data.get(field)
                if isinstance(value, list):
                    return [m for m in value if isinstance(m, dict)]
            return []
        if isinstance(data, list):
            return [m for m in data if isinstance(m, dict)]
        return []

    async def delete_memory(self, sub_tenant_id: str | None, memory_id: str) -> bool:
        """Delete one memory by id (best-effort)."""
        if not self.enabled or not sub_tenant_id or not memory_id:
            return False
        try:
            resp = await self._http().delete(
                "/memories/delete_memory",
                params={
                    "tenant_id": self._tenant_id,
                    "memory_id": memory_id,
                    "sub_tenant_id": sub_tenant_id,
                },
            )
            resp.raise_for_status()
            return True
        except Exception as exc:
            logger.error(f"[HydraDB][delete] failed (memory_id={memory_id}): {exc}")
            return False


# Module-level singleton built from the environment. Import and reuse this.
hydra = HydraMemory()


# --- Session-scoped memory cache ------------------------------------------------
#
# During a live session we serve prompts from this in-memory cache instead of
# querying HydraDB every turn. The cache is loaded once at session start and
# refreshed only occasionally (every few turns, when the user references the past,
# or after a significant memory write). Refreshes run in the background and never
# block response generation.

_PROFILE_QUERY = (
    "What are this client's recurring stressors, coping strategies, goals, "
    "preferences, important life context, and mood patterns from past sessions?"
)

_LONG_TERM_QUERY = (
    "What long-term memories about this client are most relevant for providing "
    "supportive, personalized therapy responses?"
)

# Cheap heuristic phrases that mean the user is reaching back to earlier context.
_PAST_REFERENCE_PHRASES = (
    "last time",
    "last session",
    "last week",
    "yesterday",
    "remember",
    "we talked",
    "we discussed",
    "i told you",
    "you said",
    "i mentioned",
    "like i said",
    "as i said",
    "back then",
    "used to",
    "previously",
)

# Tiny stopword set for the lexical-overlap "is this a new topic?" check.
_OVERLAP_STOPWORDS = {
    "the", "and", "but", "for", "you", "your", "with", "that", "this", "have",
    "has", "had", "are", "was", "were", "not", "can", "could", "would", "should",
    "about", "just", "like", "really", "feel", "feeling", "felt", "been", "what",
    "when", "they", "them", "there", "here", "from", "into", "out", "get", "got",
}


def _content_words(text: str) -> set[str]:
    """Lowercased 3+ letter content words, minus a few stopwords."""
    return {
        w
        for w in re.findall(r"[a-z]{3,}", (text or "").lower())
        if w not in _OVERLAP_STOPWORDS
    }


def _shares_topic(msg_words: set[str], cache_words: set[str]) -> bool:
    """True if any word pair matches exactly or shares a 4-char prefix.

    The prefix check is a cheap stand-in for stemming so e.g. stress/stressed and
    journal/journaling count as the same topic.
    """
    for mw in msg_words:
        for cw in cache_words:
            if mw == cw or (len(mw) >= 4 and len(cw) >= 4 and mw[:4] == cw[:4]):
                return True
    return False


def _memory_preview(memories: list[str], limit: int = 3) -> str:
    """Short one-line memory preview for logs."""
    return " | ".join(m[:80].replace("\n", " ") for m in memories[:limit])


class SessionMemory:
    """In-memory, per-session cache of a user's HydraDB memories.

    Loaded once at session start; refreshed sparingly. All prompt building reads
    from `context_block()` (synchronous, never hits the network). HydraDB is queried
    only by `initialize()` and `maybe_refresh_for_turn()`, and a refresh is bounded
    to REFRESH_BUDGET_SEC so it can never stall a spoken turn. Everything degrades to
    a no-op when HydraDB is disabled or there is no user_id.
    """

    REFRESH_EVERY_TURNS = 5
    MIN_REFRESH_GAP = 3  # cooldown: interval/unrelated refreshes can't fire closer than this
    SESSION_LOAD_TIMEOUT_SEC = 2.0
    SECOND_RESPONSE_WAIT_SEC = 1.0
    MAX_CACHED = 6
    RECALL_K = 5

    def __init__(self, client: HydraMemory | None = None) -> None:
        self._client = client or hydra
        self._user_id: str | None = None
        self._memories: list[str] = []
        self._profile_anchor: list[str] = []
        self._initialized = False
        self._load_task: asyncio.Task | None = None
        self._last_refresh_turn = 0
        self._refresh_task: asyncio.Task | None = None
        # Observability counters.
        self.query_count = 0
        self.cache_hits = 0

    @property
    def memories(self) -> list[str]:
        return list(self._memories)

    def context_block(self) -> str:
        """Render the cached memories as the hidden 'Relevant User Context' block."""
        return format_memory_context(self._memories)

    @property
    def is_ready(self) -> bool:
        return self._initialized

    def start_background_load(self, user_id: str | None) -> None:
        """Start session memory loading without blocking the greeting."""
        if self._load_task is None or self._load_task.done():
            self._load_task = asyncio.create_task(self.initialize(user_id))

    async def wait_until_ready(self, timeout_sec: float | None = None) -> bool:
        """Wait briefly for the session load task; returns True when cache is ready."""
        if self._initialized:
            return True
        if self._load_task is None:
            return False
        try:
            await asyncio.wait_for(
                asyncio.shield(self._load_task),
                timeout_sec or self.SECOND_RESPONSE_WAIT_SEC,
            )
        except TimeoutError:
            return False
        except Exception as exc:
            logger.error(f"[HydraDB][session-load] wait failed: {exc}")
            return False
        return self._initialized

    @property
    def stats(self) -> dict:
        """Observability snapshot: cache hits vs HydraDB queries and current size."""
        return {
            "cache_hits": self.cache_hits,
            "queries": self.query_count,
            "cached": len(self._memories),
        }

    def log_session_stats(self, session_id: str | None = None) -> None:
        """Log cache-hits vs HydraDB-queries for the session (called at teardown)."""
        total = self.cache_hits + self.query_count
        rate = (self.cache_hits / total * 100) if total else 0.0
        logger.info(
            f"[HydraDB][cache-stats] session={session_id} cache_hits={self.cache_hits} "
            f"hydradb_queries={self.query_count} cache_hit_rate={rate:.0f}% "
            f"cached={len(self._memories)}"
        )

    def _merge(self, *lists: list[str]) -> list[str]:
        """Concatenate memory lists, dedupe (case-insensitive), cap to MAX_CACHED."""
        out: list[str] = []
        seen: set[str] = set()
        for lst in lists:
            for mem in lst:
                key = (mem or "").strip().lower()
                if not key or key in seen:
                    continue
                seen.add(key)
                out.append(mem.strip())
                if len(out) >= self.MAX_CACHED:
                    return out
        return out

    async def initialize(self, user_id: str | None) -> None:
        """Load the session cache once: profile + long-term + recent memories."""
        self._user_id = user_id
        self._initialized = False
        tenant_id = getattr(self._client, "tenant_id", None)
        logger.info(
            f"[HydraDB][session-load-start] tenant_id={tenant_id} sub_tenant_id={user_id}"
        )
        if not user_id or not self._client.enabled:
            logger.info(
                f"[HydraDB][session-load-complete] skipped — "
                f"tenant_id={tenant_id} "
                f"sub_tenant_id={user_id} enabled={self._client.enabled}"
            )
            self._initialized = True
            return
        t0 = time.monotonic()
        self.query_count += 3
        try:
            profile, relevant, recent = await asyncio.wait_for(
                asyncio.gather(
                    self._client.recall(
                        user_id, _PROFILE_QUERY, max_results=self.RECALL_K, recency_bias=0.0
                    ),
                    self._client.recall(
                        user_id, _LONG_TERM_QUERY, max_results=self.RECALL_K, recency_bias=0.0
                    ),
                    self._client.recall(
                        user_id, _PROFILE_QUERY, max_results=self.RECALL_K, recency_bias=1.0
                    ),
                ),
                timeout=self.SESSION_LOAD_TIMEOUT_SEC,
            )
        except TimeoutError:
            elapsed_ms = (time.monotonic() - t0) * 1000
            logger.info(
                f"[HydraDB][session-load-complete] tenant_id={tenant_id} sub_tenant_id={user_id} "
                f"retrieved=0 latency={elapsed_ms:.0f}ms status=timeout"
            )
            self._initialized = True
            return
        except Exception as exc:
            elapsed_ms = (time.monotonic() - t0) * 1000
            logger.error(
                f"[HydraDB][session-load-complete] tenant_id={tenant_id} sub_tenant_id={user_id} "
                f"retrieved=0 latency={elapsed_ms:.0f}ms status=failed error={exc}"
            )
            self._initialized = True
            return

        self._memories = self._merge(profile, relevant, recent)
        self._profile_anchor = self._merge(profile, relevant)[:2]  # stable anchors kept across refreshes
        elapsed_ms = (time.monotonic() - t0) * 1000
        logger.info(
            f"[HydraDB][session-load-complete] tenant_id={tenant_id} sub_tenant_id={user_id} "
            f"retrieved={len(self._memories)} latency={elapsed_ms:.0f}ms "
            f"profile={len(profile)} relevant={len(relevant)} recent={len(recent)} "
            f"summaries=[{_memory_preview(self._memories)}]"
        )
        self._initialized = True

    def _references_past(self, msg: str) -> bool:
        low = msg.lower()
        return any(p in low for p in _PAST_REFERENCE_PHRASES)

    def _unrelated_to_cache(self, msg: str) -> bool:
        """True when a substantive message shares no topic words with the cache."""
        msg_words = _content_words(msg)
        if len(msg_words) < 5:
            return False  # too short to judge — don't churn the cache
        cache_words = _content_words(" ".join(self._memories))
        if not cache_words:
            return False
        return not _shares_topic(msg_words, cache_words)

    def _refresh_reason(self, turn: int, user_msg: str) -> str | None:
        """Why (if at all) this turn should refresh the cache — else None."""
        msg = (user_msg or "").strip()
        # An explicit reach into the past always refreshes (bypasses the cooldown).
        if msg and self._references_past(msg):
            return "past_reference"
        # Other triggers respect a cooldown so we never refresh on back-to-back turns.
        if turn - self._last_refresh_turn < self.MIN_REFRESH_GAP:
            return None
        if turn > 0 and turn % self.REFRESH_EVERY_TURNS == 0:
            return "interval"
        if msg and self._memories and self._unrelated_to_cache(msg):
            return "unrelated_topic"
        return None

    async def maybe_refresh_for_turn(self, user_id: str | None, user_msg: str, turn: int) -> None:
        """Refresh the cache only when warranted, always in the background.

        Ordinary turns are a pure cache hit (no network call). When a refresh is
        needed, it is scheduled and this method returns immediately so response
        generation is never blocked by HydraDB.
        """
        if not user_id or not self._client.enabled:
            return
        reason = self._refresh_reason(turn, user_msg)
        if reason is None:
            self.cache_hits += 1
            logger.debug(
                f"[HydraDB][cache] hit — turn={turn} cached={len(self._memories)} user={user_id}"
            )
            return
        if self._refresh_task is None or self._refresh_task.done():
            self._refresh_task = asyncio.create_task(
                self._refresh(user_id, user_msg, reason, turn)
            )
            logger.info(
                f"[HydraDB][refresh] scheduled reason={reason} "
                f"tenant_id={getattr(self._client, 'tenant_id', None)} "
                f"sub_tenant_id={user_id} turn={turn} cached={len(self._memories)}"
            )

    def refresh_after_memory_write(self, user_id: str | None, summary: str) -> None:
        """Schedule a non-blocking refresh after creating a significant memory."""
        if not user_id or not self._client.enabled:
            return
        if self._refresh_task is None or self._refresh_task.done():
            self._refresh_task = asyncio.create_task(
                self._refresh(user_id, summary, "memory_write", self._last_refresh_turn)
            )

    async def _refresh(self, user_id: str, user_msg: str, reason: str, turn: int) -> None:
        """Re-query HydraDB (topical), merge with profile anchors, update the cache."""
        self._last_refresh_turn = turn
        self.query_count += 1
        t0 = time.monotonic()
        query = (user_msg or "").strip() or _PROFILE_QUERY
        try:
            fresh = await self._client.recall(user_id, query, max_results=self.RECALL_K)
        except Exception as exc:
            logger.error(f"[HydraDB][refresh] failed (reason={reason}, turn={turn}): {exc}")
            return
        elapsed_ms = (time.monotonic() - t0) * 1000
        if fresh:
            self._memories = self._merge(self._profile_anchor, fresh)
        logger.info(
            f"[HydraDB][refresh] reason={reason} user={user_id} turn={turn} "
            f"retrieved={len(fresh)} cached={len(self._memories)} "
            f"latency={elapsed_ms:.0f}ms summaries=[{_memory_preview(fresh)}]"
        )
