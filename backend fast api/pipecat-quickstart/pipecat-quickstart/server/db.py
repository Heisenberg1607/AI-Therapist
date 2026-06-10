"""Postgres persistence for the therapist bot.

Writes to the same Supabase database the Node backend manages via Prisma.
The Prisma schema (backend/src/prisma/schema.prisma) defines:

    model Message { id, sessionId, sender (USER|AI), content, createdAt }
    model Session { ..., crisisFlag Boolean }

Prisma generates `id` at the app layer, so inserts here must supply a UUID.
Table/column names are PascalCase/camelCase and must be quoted.
"""

import os
import uuid
from datetime import UTC, datetime

import asyncpg
from loguru import logger

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool | None:
    """Lazily create the connection pool. Returns None if DATABASE_URL is unset."""
    global _pool
    if _pool is not None:
        return _pool

    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        logger.warning("DATABASE_URL not set — message persistence disabled")
        return None

    try:
        # statement_cache_size=0 is required for Supabase's PgBouncer
        # (transaction pooling mode rejects prepared statements).
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=1,
            max_size=2,
            statement_cache_size=0,
            ssl="require",
        )
        logger.info("Postgres pool created")
        return _pool
    except Exception as exc:
        logger.error(f"Failed to create Postgres pool: {exc}")
        return None


async def save_message(session_id: str, sender: str, content: str) -> None:
    """Persist one message. `sender` must be 'USER' or 'AI'."""
    if not session_id or not content.strip():
        return
    pool = await get_pool()
    if pool is None:
        return
    message_id = str(uuid.uuid4())
    created_at = datetime.now(UTC).replace(tzinfo=None)
    try:
        async with pool.acquire() as conn:
            status = await conn.execute(
                'INSERT INTO "Message" ("id", "sessionId", "sender", "content", "createdAt") '
                'VALUES ($1, $2, $3::"Sender", $4, $5)',
                message_id,
                session_id,
                sender,
                content,
                # "createdAt" is `timestamp without time zone`; asyncpg rejects a
                # tz-aware datetime against it ("can't subtract offset-naive and
                # offset-aware datetimes"). Store naive UTC, matching how Prisma
                # persists DateTime on the Node side.
                created_at,
            )
        # asyncpg returns "INSERT 0 1" when exactly one row was written.
        if status == "INSERT 0 1":
            logger.info(
                f"Message stored in Supabase | id={message_id} session={session_id} "
                f"sender={sender} createdAt={created_at.isoformat()} "
                f"content={content[:80]!r}"
            )
        else:
            logger.error(
                f"Data not stored | unexpected insert status {status!r} "
                f"for session {session_id}"
            )
    except Exception as exc:
        logger.error(f"Data not stored | session={session_id} error: {exc}")


async def get_messages_by_session(session_id: str) -> list[dict]:
    """Fetch a session's stored messages as [{role, content, timestamp}],
    ordered oldest-first. Returns [] if unavailable."""
    if not session_id:
        return []
    pool = await get_pool()
    if pool is None:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                'SELECT "sender", "content", "createdAt" FROM "Message" '
                'WHERE "sessionId" = $1 ORDER BY "createdAt" ASC',
                session_id,
            )
        role_map = {"USER": "user", "AI": "assistant"}
        return [
            {
                "role": role_map.get(r["sender"], "user"),
                "content": r["content"],
                "timestamp": r["createdAt"].isoformat() if r["createdAt"] else None,
            }
            for r in rows
        ]
    except Exception as exc:
        logger.error(f"Failed to fetch messages for session {session_id}: {exc}")
        return []


async def set_crisis_flag(session_id: str) -> None:
    """Mark a session as having triggered a crisis signal."""
    if not session_id:
        return
    pool = await get_pool()
    if pool is None:
        return
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                'UPDATE "Session" SET "crisis_flag" = true WHERE "id" = $1',
                session_id,
            )
    except Exception as exc:
        logger.error(f"Failed to set crisis flag for session {session_id}: {exc}")


async def close_pool() -> None:
    """Close the pool on shutdown."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
