#
# Copyright (c) 2024–2025, Daily
#
# SPDX-License-Identifier: BSD 2-Clause License
#

"""AI Therapist Bot - Pipecat Voice Agent

This bot uses a cascade pipeline: Speech-to-Text → LLM → Text-to-Speech

Required AI services:
- Deepgram (Speech-to-Text)
- NVIDIA NIM (LLM via OpenAI-compatible API)
- ElevenLabs (Text-to-Speech)

It also re-implements the features the old Node WebSocket flow carried:
- Crisis detection (LLM function → RTVI server-message to client + DB crisisFlag)
- Message persistence to the shared Postgres DB (Prisma schema)
- Cekura transcript evaluation on disconnect

Run the bot using::

    uv run bot.py
"""

import json
import os
from datetime import UTC, datetime
from typing import Any

from dotenv import load_dotenv
from loguru import logger
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import Frame, LLMFullResponseEndFrame, LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.frameworks.rtvi.frames import RTVIServerMessageFrame
from pipecat.runner.types import DailyRunnerArguments, RunnerArguments, SmallWebRTCRunnerArguments
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.llm_service import FunctionCallParams
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.audio.filters.rnnoise_filter import RNNoiseFilter
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams, DailyTransport
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

import cekura
import db

from pathlib import Path


def load_latest_prompt() -> str:
    prompts_dir = Path(__file__).parent / "prompts"
    files = sorted(prompts_dir.glob("v*.txt"))
    if not files:
        return "You are a helpful voice assistant. Keep responses concise and conversational."
    latest = files[-1]
    print(f"[Bot] Loading prompt: {latest.name}")
    return latest.read_text().strip()


def save_transcript_file(session_id: str, transcript: list[dict]) -> None:
    """Write a completed session's transcript to transcripts/<session_id>.json."""
    transcripts_dir = Path(__file__).parent / "transcripts"
    transcripts_dir.mkdir(exist_ok=True)
    path = transcripts_dir / f"{session_id}.json"
    path.write_text(
        json.dumps({"session_id": session_id, "turns": transcript}, indent=2)
    )
    print(f"[Bot] Saved transcript: {path.name} ({len(transcript)} turns)")


load_dotenv(override=True)

SYSTEM_PROMPT = """Act as a real human therapist having a casual, natural conversation with a client.

Your tone should feel:
- Warm and understanding
- Simple and conversational
- Like talking to a thoughtful friend, not a formal therapist

Style guidelines:
- Use short to medium sentences (avoid long, perfect paragraphs)
- Include natural pauses like: "hmm...", "yeah", "I get that"
- Don't sound overly polished or "textbook"
- Avoid over-explaining or analyzing everything
- Don't always reframe or summarize — just respond naturally
- Let the conversation breathe (some responses can be simple)
- Occasionally reflect feelings, but keep it subtle
- Ask gentle, simple follow-up questions (1 at a time)

Behavior:
- Validate emotions in a natural way (not scripted like "that sounds difficult" every time)
- Don't jump into solutions or advice too quickly
- Don't try to sound perfect — slight imperfection makes it human
- Avoid repeating patterns in every response
- Let the conversation flow like a real back-and-forth
- Make the conversation feel real, slightly messy, and emotionally genuine — not like AI or a scripted counselor

When appropriate, use your available tools to log emotions, save important notes, or detect crisis situations."""

ROLE_TO_SENDER = {"user": "USER", "assistant": "AI"}

# Kickoff message that prompts the agent's opening line. Also used to recognize
# (and ignore) the pre-conversation turn so the crisis tool can't fire on it.
SESSION_START_MESSAGE = (
    "Begin the session now with a short, warm, one or two sentence greeting that "
    "welcomes me and gently invites me to share what's on my mind. Keep it light — "
    "do not ask anything heavy yet."
)


def _extract_text(content: Any) -> str:
    """Flatten a context message's content to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        ]
        return " ".join(p for p in parts if p)
    return ""


class ConversationPersister(FrameProcessor):
    """Snapshots the shared LLMContext as the conversation progresses, persisting
    each new user/assistant message to the DB and accumulating a transcript for
    Cekura. Uses the context (not raw frames) as the source of truth to avoid
    depending on frame-routing details.
    """

    def __init__(self, context: LLMContext, session_id: str | None):
        super().__init__()
        self._context = context
        self._session_id = session_id
        self._cursor = 0
        self.transcript: list[dict] = []

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        # The assistant turn lands in context after the LLM response completes;
        # snapshot here, and once more on disconnect for the trailing message.
        if isinstance(frame, LLMFullResponseEndFrame):
            await self.flush()
        await self.push_frame(frame, direction)

    async def flush(self):
        """Persist any context messages we haven't seen yet."""
        messages = self._context.get_messages()
        while self._cursor < len(messages):
            msg = messages[self._cursor]
            self._cursor += 1
            role = msg.get("role") if isinstance(msg, dict) else None
            sender = ROLE_TO_SENDER.get(role or "")
            if not sender:
                continue
            text = _extract_text(msg.get("content")).strip()
            if not text:
                continue
            self.transcript.append(
                {
                    "role": role,
                    "content": text,
                    "timestamp": datetime.now(UTC).isoformat(),
                }
            )
            await db.save_message(self._session_id, sender, text)


async def run_bot(
    transport: BaseTransport,
    session_id: str | None,
    user_id: str | None,
    system_prompt: str | None = None,
):
    """Main bot logic."""
    logger.info(f"Starting bot (session_id={session_id}, user_id={user_id})")

    # Speech-to-Text service
    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))

    # Text-to-Speech service - ElevenLabs
    tts = ElevenLabsTTSService(
        api_key=os.getenv("ELEVENLABS_API_KEY"),
        voice_id=os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb"),
        settings=ElevenLabsTTSService.Settings(
            model="eleven_flash_v2_5",
        ),
    )

    # LLM service - NVIDIA NIM via OpenAI-compatible API
    # stop=["<think>"] cuts off Llama chain-of-thought leaks at the API level
    llm = OpenAILLMService(
        api_key=os.getenv("NVIDIA_API_KEY"),
        base_url="https://integrate.api.nvidia.com/v1",
        settings=OpenAILLMService.Settings(
            model="meta/llama-3.1-8b-instruct",
            extra={"stop": ["<think>", "\n<think>"]},
        ),
    )

    # Crisis-detection tool — mirrors backend/src/Service/therapistFunctions.ts
    crisis_tool = FunctionSchema(
        name="detect_crisis_intent",
        description=(
            "Flag a mental-health crisis. ONLY call this when the USER has, in their "
            "own words, explicitly expressed suicidal thoughts, intent to harm "
            "themselves or others, self-harm, or that they are in immediate danger. "
            "Do NOT call it as a greeting, at the start of a session, proactively, or "
            "for ordinary stress, sadness, anxiety, or worry. When in doubt, do not "
            "call it."
        ),
        properties={
            "severity": {
                "type": "string",
                "enum": ["low", "medium", "high"],
                "description": "Severity of the crisis signal",
            },
            "trigger_phrases": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Specific phrases that triggered this",
            },
        },
        required=["severity"],
    )

    context = LLMContext(
        messages=[],
        tools=ToolsSchema(standard_tools=[crisis_tool]),
    )
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    persister = ConversationPersister(context, session_id)

    # Pipeline - persister sits right after the LLM so it observes response-end
    # frames; it reads the shared context for message text.
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            persister,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        observers=[],
    )

    async def detect_crisis_intent(params: FunctionCallParams):
        # Guard against false triggers before the user has actually said anything
        # (e.g. the model calling this on the opening greeting turn).
        real_user_input = False
        for m in context.get_messages():
            if not isinstance(m, dict) or m.get("role") != "user":
                continue
            text = _extract_text(m.get("content")).strip()
            if text and text != SESSION_START_MESSAGE:
                real_user_input = True
                break
        if not real_user_input:
            logger.info("Ignoring crisis tool call before any real user input")
            await params.result_callback({"status": "IGNORED_NO_USER_INPUT"})
            return

        severity = params.arguments.get("severity", "unknown")
        logger.warning(f"Crisis detected (severity={severity}) for session {session_id}")
        # Notify the client so it can raise the CrisisModal. The client receives
        # this via its onGenericMessage callback (type: "crisis").
        await worker.queue_frames(
            [RTVIServerMessageFrame(data={"event": "crisis", "severity": severity})]
        )
        if session_id:
            await db.set_crisis_flag(session_id)
        await params.result_callback({"status": "ACKNOWLEDGED"})

    llm.register_function("detect_crisis_intent", detect_crisis_intent)

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        base_prompt = load_latest_prompt()
        final_prompt = base_prompt + "\n\n" + system_prompt if system_prompt else base_prompt
        context.add_message({"role": "system", "content": final_prompt})
        context.add_message({"role": "user", "content": SESSION_START_MESSAGE})
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        try:
            # Capture the trailing assistant message.
            await persister.flush()
            transcript = await db.get_messages_by_session(session_id) if session_id else []
            if not transcript:
                transcript = persister.transcript
            save_transcript_file(session_id, transcript)
            await cekura.send_transcript(session_id, transcript)
        except Exception as e:
            logger.error(f"Error during disconnect cleanup: {e}")
        finally:
            await worker.cancel()

    runner = WorkerRunner(handle_sigint=False)

    await runner.add_workers(worker)
    await runner.run()


async def bot(runner_args: RunnerArguments):
    """Main bot entry point."""

    # Session identity is forwarded from the frontend via requestData.body.
    body = runner_args.body if isinstance(runner_args.body, dict) else {}
    import uuid
    session_id = body.get("sessionId") or str(uuid.uuid4())
    user_id = body.get("userId")
    system_prompt = body.get("systemPrompt")

    transport = None

    match runner_args:
        case DailyRunnerArguments():
            transport = DailyTransport(
                runner_args.room_url,
                runner_args.token,
                "AI Therapist Bot",
                params=DailyParams(
                    audio_in_enabled=True,
                    audio_out_enabled=True,
                    audio_in_filter=RNNoiseFilter(),
                ),
            )
        case SmallWebRTCRunnerArguments():
            webrtc_connection: SmallWebRTCConnection = runner_args.webrtc_connection

            transport = SmallWebRTCTransport(
                webrtc_connection=webrtc_connection,
                params=TransportParams(
                    audio_in_enabled=True,
                    audio_out_enabled=True,
                    audio_in_filter=RNNoiseFilter(),
                ),
            )
        case _:
            logger.error(f"Unsupported runner arguments type: {type(runner_args)}")
            return

    await run_bot(transport, session_id, user_id, system_prompt)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
