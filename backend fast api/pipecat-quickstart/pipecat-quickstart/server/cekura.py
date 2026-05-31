"""Cekura transcript evaluation.

Mirrors the Node backend's CekuraService.ts: POST the finished call transcript
to Cekura's observability endpoint so it can score the conversation. Must be
sent within ~5 minutes of the call ending.
"""

import os

import httpx
from loguru import logger

CEKURA_API_URL = "https://api.cekura.ai/observability/v1/observe/"


async def send_transcript(session_id: str, messages: list[dict]) -> bool:
    """Send the transcript to Cekura. `messages` is a list of
    {role, content, timestamp} dicts. Returns True on success."""
    api_key = os.getenv("CEKURA_API_KEY")
    agent_id = os.getenv("CEKURA_AGENT_ID", "therapist-bot")

    if not api_key:
        logger.warning("CEKURA_API_KEY not set — skipping transcript evaluation")
        return False
    if not messages:
        logger.warning(f"No messages to send to Cekura for session {session_id}")
        return False

    payload = {
        "agent_id": agent_id,
        "run_id": session_id,
        "transcript_type": "pipecat",
        "transcript_json": messages,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                CEKURA_API_URL,
                json=payload,
                headers={
                    "X-CEKURA-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
        logger.info(
            f"Cekura accepted transcript for session {session_id} "
            f"({len(messages)} messages, status {response.status_code})"
        )
        return True
    except Exception as exc:
        logger.error(f"Failed to send transcript to Cekura for session {session_id}: {exc}")
        return False
