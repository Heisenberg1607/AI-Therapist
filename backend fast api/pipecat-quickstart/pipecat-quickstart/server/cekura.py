"""Cekura transcript evaluation + self-improvement loop.

Two responsibilities:

1. `send_transcript` — POST the finished call transcript to Cekura's
   observability endpoint so it scores the conversation. Must be sent within
   ~5 minutes of the call ending. (Mirrors the Node backend's CekuraService.ts.)

2. `run_self_improvement` — the self-improving loop. After a session ends and
   the transcript has been sent, Cekura evaluates it asynchronously. We then:
     - poll until the call log has an evaluation,
     - ask Cekura to improve the current system prompt against any failing
       metrics / critical deviations in that call,
     - and, if it produces an improved prompt, write it as the next prompt
       version (`prompts/v<N+1>.txt`).
   The bot's `load_latest_prompt` always loads the highest version, so the next
   session automatically runs on the improved prompt. Cekura only returns an
   improvement when it actually finds an issue, so good sessions leave the
   prompt untouched.
"""

import asyncio
import json
import os
import re
from pathlib import Path

import httpx
from loguru import logger

CEKURA_BASE = "https://api.cekura.ai"
CEKURA_API_URL = f"{CEKURA_BASE}/observability/v1/observe/"
CALL_LOGS_URL = f"{CEKURA_BASE}/observability/v1/call-logs/"
IMPROVE_PROMPT_BG_URL = f"{CALL_LOGS_URL}improve_prompt_bg/"
IMPROVE_PROMPT_PROGRESS_URL = f"{CALL_LOGS_URL}improve_prompt_progress/"

# Polling budgets (seconds). Cekura evaluation and prompt-improvement both run
# asynchronously, so we poll. Kept conservative so disconnect cleanup can't hang
# indefinitely; tune via env without touching code.
EVAL_POLL_INTERVAL = float(os.getenv("CEKURA_EVAL_POLL_INTERVAL", "5"))
EVAL_MAX_WAIT = float(os.getenv("CEKURA_EVAL_MAX_WAIT", "120"))
IMPROVE_POLL_INTERVAL = float(os.getenv("CEKURA_IMPROVE_POLL_INTERVAL", "5"))
IMPROVE_MAX_WAIT = float(os.getenv("CEKURA_IMPROVE_MAX_WAIT", "150"))


def _api_key() -> str | None:
    return os.getenv("CEKURA_API_KEY")


def _headers() -> dict:
    return {"X-CEKURA-API-KEY": _api_key() or "", "Content-Type": "application/json"}


async def send_transcript(session_id: str, messages: list[dict]) -> bool:
    """Send the transcript to Cekura. `messages` is a list of
    {role, content, timestamp} dicts. Returns True on success."""
    api_key = _api_key()
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
            response = await client.post(CEKURA_API_URL, json=payload, headers=_headers())
            response.raise_for_status()
        logger.info(
            f"Cekura accepted transcript for session {session_id} "
            f"({len(messages)} messages, status {response.status_code})"
        )
        return True
    except Exception as exc:
        logger.error(f"Failed to send transcript to Cekura for session {session_id}: {exc}")
        return False


# --- Prompt versioning -------------------------------------------------------
# Prompts live in prompts/v<N>.txt. The active prompt is always the highest N.

_PROMPT_RE = re.compile(r"^v(\d+)\.txt$")


def _prompt_version(path: Path) -> int:
    match = _PROMPT_RE.match(path.name)
    return int(match.group(1)) if match else -1


def latest_prompt_file(prompts_dir: Path) -> Path | None:
    """Highest-numbered prompt file, or None if there are none. Sorts
    numerically so v10 beats v9 (plain string sort would not)."""
    files = [p for p in prompts_dir.glob("v*.txt") if _prompt_version(p) >= 0]
    return max(files, key=_prompt_version) if files else None


def next_prompt_file(prompts_dir: Path) -> Path:
    latest = latest_prompt_file(prompts_dir)
    version = _prompt_version(latest) + 1 if latest else 1
    return prompts_dir / f"v{version}.txt"


# --- Self-improvement loop ---------------------------------------------------


async def _find_evaluated_call_log(
    client: httpx.AsyncClient, agent_id: str, session_id: str
) -> int | None:
    """Poll Cekura until the call log for this session has an evaluation, then
    return its integer DB id. Returns None if it never shows up in time."""
    # Cekura stores our observe run_id as the call log's `call_id` string.
    filters = json.dumps({"field": "call_id", "op": "eq", "value": session_id})
    deadline = asyncio.get_event_loop().time() + EVAL_MAX_WAIT
    while True:
        try:
            resp = await client.get(
                CALL_LOGS_URL,
                headers=_headers(),
                params={"agent_id": agent_id, "page_size": 1, "filters_v2": filters},
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if results:
                call_log = results[0]
                evaluation = call_log.get("evaluation")
                if isinstance(evaluation, dict) and evaluation.get("metrics"):
                    return call_log.get("id")
        except Exception as exc:
            logger.warning(f"Cekura call-log lookup failed for {session_id}: {exc}")

        if asyncio.get_event_loop().time() >= deadline:
            return None
        await asyncio.sleep(EVAL_POLL_INTERVAL)


async def _poll_improvement(client: httpx.AsyncClient, progress_id: str) -> dict | None:
    """Poll the improve_prompt background job. Returns the output dict
    (`{improved_prompt, summary_of_changes}`) on success, or None when the job
    finds no issues / fails / times out."""
    deadline = asyncio.get_event_loop().time() + IMPROVE_MAX_WAIT
    while True:
        try:
            resp = await client.get(
                IMPROVE_PROMPT_PROGRESS_URL,
                headers=_headers(),
                params={"progress_id": progress_id},
            )
            resp.raise_for_status()
            data = resp.json()
            output = data.get("output")
            if isinstance(output, dict) and output.get("improved_prompt"):
                return output
            status = (data.get("status") or "").lower()
            error = data.get("error")
            if status in ("error", "failed", "cancelled") or (output is None and error):
                # "No issues found" is the common, healthy case for a good session.
                logger.info(
                    f"Cekura found nothing to improve "
                    f"({error or status or 'no output'})"
                )
                return None
        except Exception as exc:
            logger.warning(f"Cekura improve-prompt poll failed: {exc}")

        if asyncio.get_event_loop().time() >= deadline:
            logger.warning("Cekura improve-prompt timed out")
            return None
        await asyncio.sleep(IMPROVE_POLL_INTERVAL)


async def run_self_improvement(
    session_id: str | None, current_prompt: str, prompts_dir: Path
) -> Path | None:
    """Run the self-improving loop for a finished session.

    Waits for Cekura to evaluate the call, asks it to improve `current_prompt`
    against any issues found, and writes the result as the next prompt version.
    Returns the new prompt file path if a new version was written, else None.
    Never raises — self-improvement failures must not break disconnect cleanup.
    """
    if os.getenv("CEKURA_SELF_IMPROVE", "true").lower() in ("0", "false", "no"):
        logger.info("Cekura self-improvement disabled via CEKURA_SELF_IMPROVE")
        return None

    api_key = _api_key()
    agent_id = os.getenv("CEKURA_AGENT_ID")
    if not api_key or not agent_id:
        logger.warning("Cekura self-improvement skipped — missing API key or agent id")
        return None
    if not session_id or not current_prompt:
        return None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info(f"Self-improvement: waiting for Cekura evaluation of {session_id}")
            call_log_id = await _find_evaluated_call_log(client, agent_id, session_id)
            if not call_log_id:
                logger.warning(
                    f"Self-improvement: no evaluated call log for {session_id} in time"
                )
                return None

            logger.info(
                f"Self-improvement: requesting prompt improvement from call log {call_log_id}"
            )
            resp = await client.post(
                IMPROVE_PROMPT_BG_URL,
                headers=_headers(),
                json={
                    "call_logs": [call_log_id],
                    "prompt": current_prompt,
                    "agent_id": agent_id,
                },
            )
            resp.raise_for_status()
            progress_id = resp.json().get("progress_id")
            if not progress_id:
                logger.warning("Self-improvement: no progress_id returned by Cekura")
                return None

            output = await _poll_improvement(client, progress_id)
            if not output:
                return None

            improved = output["improved_prompt"].strip()
            if improved == current_prompt.strip():
                logger.info("Self-improvement: improved prompt identical to current — skipping")
                return None

            new_path = next_prompt_file(prompts_dir)
            new_path.write_text(improved + "\n")
            summary = output.get("summary_of_changes", "").strip()
            logger.info(
                f"Self-improvement: wrote {new_path.name}. "
                f"Changes: {summary or '(none provided)'}"
            )
            return new_path
    except Exception as exc:
        logger.error(f"Self-improvement loop failed for session {session_id}: {exc}")
        return None
