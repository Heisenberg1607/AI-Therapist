"""Prompt self-improvement driven by LLM-judge scores.

After a session is scored (see ``weave_eval``), this module checks whether any
thresholded metric fell short and, if so, asks an NVIDIA NIM model to rewrite
the current system prompt to target ONLY the failing metrics. The rewrite is
saved as the next prompt version (``prompts/v<N+1>.txt``) so the bot's prompt
loader picks it up on the next session. Every evaluation is also written to a
JSON report under ``reports/``.
"""

import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path

import weave
from dotenv import load_dotenv
from loguru import logger
from openai import AsyncOpenAI

# bot.py imports this module before it calls load_dotenv(); load here so the
# NIM client has credentials regardless of import order.
load_dotenv()

PROMPTS_DIR = Path(__file__).parent / "prompts"
REPORTS_DIR = Path(__file__).parent / "reports"

# Metrics that gate prompt improvement, with their minimum acceptable score.
# (safety_detection is intentionally excluded — it is not a prompt-style metric.)
THRESHOLDS = {
    "empathy": 4.0,
    "conciseness": 4.0,
    "task_completion": 4.0,
    "active_listening": 4.0,
}

# Rewrite model preference: NVIDIA NIM when configured, else OpenAI.
NIM_MODEL = "meta/llama-3.1-8b-instruct"
OPENAI_REWRITE_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

_PROMPT_RE = re.compile(r"^v(\d+)\.txt$")


def _version_num(name: str) -> int:
    """Numeric version of a ``v<N>.txt`` filename, or -1 if it doesn't match."""
    match = _PROMPT_RE.match(name)
    return int(match.group(1)) if match else -1


def load_latest_prompt() -> tuple[str, str]:
    """Return ``(prompt_text, filename)`` for the highest-versioned prompts/v*.txt.

    Sorts numerically so v10 beats v9. Falls back to a default prompt if no
    versioned prompt files exist.
    """
    files = [p for p in PROMPTS_DIR.glob("v*.txt") if _version_num(p.name) >= 0]
    if not files:
        return (
            "You are a helpful voice assistant. Keep responses concise and conversational.",
            "v0.txt",
        )
    latest = max(files, key=lambda p: _version_num(p.name))
    return (latest.read_text().strip(), latest.name)


def _rewrite_client() -> tuple[AsyncOpenAI, str]:
    """Return (client, model). Prefer NVIDIA NIM; fall back to OpenAI."""
    nvidia_key = os.getenv("NVIDIA_API_KEY")
    if nvidia_key:
        return (
            AsyncOpenAI(
                api_key=nvidia_key,
                base_url=os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
            ),
            NIM_MODEL,
        )
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        logger.warning("NVIDIA_API_KEY not set — using OpenAI for prompt rewrite")
        return (AsyncOpenAI(api_key=openai_key), OPENAI_REWRITE_MODEL)
    raise RuntimeError("No NVIDIA_API_KEY or OPENAI_API_KEY configured for prompt rewrite")


def get_next_version(current_name: str) -> str:
    """Map a prompt filename to the next version: ``v2.txt`` -> ``v3.txt``."""
    num = _version_num(current_name)
    if num < 0:
        num = 0
    return f"v{num + 1}.txt"


@weave.op(name="generate_improved_prompt", kind="llm")
async def generate_improved_prompt(current_prompt: str, failed_summary: str) -> str:
    """Rewrite the system prompt to target the failing metrics.

    This is a Weave op: the inputs (the current prompt and the failing-metric
    summary) and the output (the rewritten prompt) are all visible in the Weave
    trace, so the generated prompt is inspectable alongside the session scores.
    """
    instructions = (
        "You are improving the system prompt for an AI therapist voice agent. "
        "The previous session scored below target on these metrics ONLY: "
        f"{failed_summary}. Rewrite the system prompt so future sessions improve "
        "on those specific metrics, while preserving everything that already "
        "works. Do not change the agent's core role, persona, or its "
        "crisis-detection behavior. Return ONLY the full rewritten system prompt "
        "as plain text — no preamble, no markdown, no explanation."
    )

    client, model = _rewrite_client()
    response = await client.chat.completions.create(
        model=model,
        temperature=0.4,
        messages=[
            {"role": "system", "content": instructions},
            {"role": "user", "content": f"CURRENT SYSTEM PROMPT:\n{current_prompt}"},
        ],
    )
    return (response.choices[0].message.content or "").strip()


async def maybe_improve(scores: dict) -> str | None:
    """Rewrite the system prompt if any thresholded metric failed.

    Returns the new prompt filename if a rewrite was written, otherwise None.
    Never raises — improvement failures must not break disconnect cleanup.
    """
    failed = {
        metric: scores.get(metric)
        for metric, threshold in THRESHOLDS.items()
        if scores.get(metric, 0.0) < threshold
    }

    if not failed:
        logger.info("[improver] All metrics met thresholds — no improvement needed.")
        return None

    logger.info(f"[improver] Metrics below threshold: {failed}")

    current_prompt, current_name = load_latest_prompt()
    new_name = get_next_version(current_name)

    failed_summary = ", ".join(
        f"{m} (scored {scores.get(m)}, target {THRESHOLDS[m]})" for m in failed
    )

    try:
        improved = await generate_improved_prompt(current_prompt, failed_summary)
    except Exception as exc:
        logger.error(f"[improver] Rewrite failed ({exc}); skipping improvement")
        return None

    if not improved or improved == current_prompt.strip():
        logger.info("[improver] Rewrite empty or unchanged — skipping.")
        return None

    new_path = PROMPTS_DIR / new_name
    new_path.write_text(improved + "\n")
    logger.info(f"[improver] Wrote improved prompt: {new_path}")
    return new_name


def save_report(
    session_id: str,
    scores: dict,
    prompt_version: str,
    new_version: str | None,
) -> None:
    """Write a JSON evaluation report to ``reports/<session_id>.json``."""
    REPORTS_DIR.mkdir(exist_ok=True)
    report = {
        "session_id": session_id,
        "prompt_version_used": prompt_version,
        "scores": scores,
        "improvement_triggered": new_version is not None,
        "new_prompt_version": new_version,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    path = REPORTS_DIR / f"{session_id}.json"
    path.write_text(json.dumps(report, indent=2))
    logger.info(f"[improver] Saved report: {path}")
