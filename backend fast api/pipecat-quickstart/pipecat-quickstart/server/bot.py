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

import asyncio
import json
import os
from datetime import UTC, datetime
from typing import Any

from dotenv import load_dotenv
from loguru import logger
from openai import AsyncOpenAI
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.turns.user_turn_strategies import UserTurnStrategies
from pipecat.turns.user_stop import TurnAnalyzerUserTurnStopStrategy
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

import db
import improver
import weave_eval

from pathlib import Path


PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_latest_prompt() -> str:
    # Prompt versioning now lives in improver (cekura was removed); delegate to
    # it so the bot still loads the highest-versioned prompt.
    text, name = improver.load_latest_prompt()
    print(f"[Bot] Loading prompt: {name}")
    return text


def save_transcript_file(session_id: str, transcript: list[dict]) -> None:
    """Write a completed session's transcript to transcripts/<session_id>.json."""
    transcripts_dir = Path(__file__).parent / "transcripts"
    transcripts_dir.mkdir(exist_ok=True)
    path = transcripts_dir / f"{session_id}.json"
    path.write_text(
        json.dumps({"session_id": session_id, "turns": transcript}, indent=2)
    )
    print(f"[Bot] Saved transcript: {path.name} ({len(transcript)} turns)")


def save_summaries_file(session_id: str, summaries: list[dict]) -> None:
    """Write the rolling summaries to transcripts/<session_id>_summaries.json."""
    transcripts_dir = Path(__file__).parent / "transcripts"
    transcripts_dir.mkdir(exist_ok=True)
    path = transcripts_dir / f"{session_id}_summaries.json"
    path.write_text(
        json.dumps({"session_id": session_id, "summaries": summaries}, indent=2)
    )
    print(f"[Bot] Saved summaries: {path.name} ({len(summaries)} summaries)")


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


class RollingSummarizer(FrameProcessor):
    """Maintains a growing clinical summary of the conversation.

    Counts completed turns via LLMFullResponseEndFrame (one per assistant
    response). Every SUMMARY_INTERVAL turns it asks an NVIDIA NIM model to fold
    the most recent turns (plus any prior summary) into a single 2-3 sentence
    running summary with an emotional tag, then PREPENDS that summary as a
    system message at position 1 of the LLMContext — right after the main
    system prompt at position 0. The original turns are never deleted, so the
    summary accumulates and nothing is lost.

    The NIM call runs in a background task so it never stalls the audio
    pipeline; the context is mutated synchronously once the call returns.
    """

    SUMMARY_INTERVAL = 12
    EMOTIONAL_TAGS = (
        "anxious",
        "sad",
        "angry",
        "hopeful",
        "avoidant",
        "numb",
        "opening_up",
    )
    SUMMARY_PREFIX = "Session summary so far:"

    def __init__(
        self,
        context: LLMContext,
        llm_client: AsyncOpenAI,
        model: str = "meta/llama-3.1-8b-instruct",
    ):
        super().__init__()
        self._context = context
        self._llm = llm_client
        self._model = model
        self.turn_count = 0
        # Exposed so the session can persist/forward the summaries (e.g. to Weave).
        self.summaries: list[dict] = []
        # Accumulated summary text (without the formatting/tag) for the next merge.
        self._accumulated_summary: str | None = None
        self._summarizing = False
        self._summarize_task: asyncio.Task | None = None

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        # One LLMFullResponseEndFrame == one completed assistant turn.
        if isinstance(frame, LLMFullResponseEndFrame):
            self.turn_count += 1
            if self.turn_count % self.SUMMARY_INTERVAL == 0 and not self._summarizing:
                self._summarizing = True
                # Run in the background so summarization latency never blocks TTS.
                self._summarize_task = asyncio.create_task(
                    self._run_summary(self.turn_count)
                )
        await self.push_frame(frame, direction)

    async def _run_summary(self, turn_number: int):
        try:
            recent = self._recent_turns_text()
            if not recent:
                return
            result = await self._summarize(self._accumulated_summary, recent)
            if not result:
                return
            summary_text, tag = result
            # Combined summary (old + new turns) becomes the basis for next merge.
            self._accumulated_summary = summary_text
            content = f"{self.SUMMARY_PREFIX} {summary_text} Emotional state: {tag}"
            self._insert_summary(content)
            self.summaries.append(
                {
                    "turn": turn_number,
                    "summary": summary_text,
                    "emotional_tag": tag,
                    "timestamp": datetime.now(UTC).isoformat(),
                }
            )
            print(f"[Summarizer] Turn {turn_number} summarized → emotional_tag: {tag}")
        except Exception as exc:
            logger.error(f"[Summarizer] Summarization failed at turn {turn_number}: {exc}")
        finally:
            self._summarizing = False

    def _recent_turns_text(self) -> str:
        """Render the last SUMMARY_INTERVAL user/assistant turns as dialogue."""
        convo = [
            m
            for m in self._context.get_messages()
            if isinstance(m, dict) and m.get("role") in ("user", "assistant")
        ]
        lines = []
        for m in convo[-self.SUMMARY_INTERVAL :]:
            speaker = "Client" if m.get("role") == "user" else "Therapist"
            text = _extract_text(m.get("content")).strip()
            if text:
                lines.append(f"{speaker}: {text}")
        return "\n".join(lines)

    def _is_summary_message(self, m: Any) -> bool:
        return (
            isinstance(m, dict)
            and m.get("role") == "system"
            and isinstance(m.get("content"), str)
            and m["content"].startswith(self.SUMMARY_PREFIX)
        )

    def _insert_summary(self, content: str):
        """Put the summary at position 1, keeping the system prompt at position 0.

        If a previous summary already sits at position 1 it is replaced (the new
        content already merges old + new). All conversation turns are preserved.
        """
        messages = list(self._context.get_messages())
        if not messages:
            return
        system_msg = messages[0]  # main system prompt — always position 0
        rest = messages[1:]
        if rest and self._is_summary_message(rest[0]):
            rest = rest[1:]  # drop the old summary; we replace it
        summary_msg = {"role": "system", "content": content}
        self._context.set_messages([system_msg, summary_msg, *rest])

    async def _summarize(self, old_summary: str | None, recent_turns: str):
        """Call NIM to merge old summary + recent turns. Returns (summary, tag)."""
        user_content = (
            f"Existing running summary (may be empty):\n{old_summary or '(none)'}\n\n"
            f"New conversation turns to fold in:\n{recent_turns}\n\n"
            "Merge the existing summary and the new turns into ONE running summary "
            "of 2-3 sentences capturing the client's core concerns and current "
            "focus. Then choose the single emotional tag that best fits the "
            "client's current state, from EXACTLY this list: "
            f"{', '.join(self.EMOTIONAL_TAGS)}.\n\n"
            'Return ONLY valid JSON: {"summary": "<2-3 sentences>", '
            '"emotional_tag": "<one tag>"}. No markdown, no explanation.'
        )
        response = await self._llm.chat.completions.create(
            model=self._model,
            temperature=0.3,
            messages=[
                {
                    "role": "system",
                    "content": "You are a concise clinical note-taker for a therapy session.",
                },
                {"role": "user", "content": user_content},
            ],
        )
        raw = response.choices[0].message.content or ""
        return self._parse(raw)

    def _parse(self, raw: str):
        try:
            data = json.loads(raw)
        except Exception:
            try:
                data = json.loads(raw[raw.index("{") : raw.rindex("}") + 1])
            except Exception:
                logger.warning(f"[Summarizer] Could not parse summary JSON: {raw[:120]!r}")
                return None
        summary = str(data.get("summary", "")).strip()
        tag = str(data.get("emotional_tag", "")).strip().lower()
        if not summary:
            return None
        if tag not in self.EMOTIONAL_TAGS:
            tag = "numb"  # neutral fallback when the model returns an off-list tag
        return summary, tag


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

    # LLM service - OpenAI API
    llm = OpenAILLMService(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url="https://api.openai.com/v1",
        settings=OpenAILLMService.Settings(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
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
    # Semantic end-of-turn detection. Smart Turn v3 is Pipecat's default stop
    # strategy as of 1.3.0; we wire it explicitly so the behavior is visible and
    # locked against future default changes, and so stop_secs is tunable here.
    smart_turn = LocalSmartTurnAnalyzerV3(
        params=SmartTurnParams(
            stop_secs=2.0,        # silence fallback when the model is unsure (default 3.0)
            pre_speech_ms=500,    # default
            max_duration_secs=8,  # default
        ),
    )

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(),  # default stop_secs=0.2, already snappy
            user_turn_strategies=UserTurnStrategies(
                stop=[TurnAnalyzerUserTurnStopStrategy(turn_analyzer=smart_turn)],
            ),
        ),
    )

    persister = ConversationPersister(context, session_id)

    # Rolling summarizer LLM client — prefer NVIDIA NIM, fall back to OpenAI so
    # it still works when NVIDIA_API_KEY is unset (mirrors weave_eval/improver).
    if os.getenv("NVIDIA_API_KEY"):
        summarizer_client = AsyncOpenAI(
            api_key=os.getenv("NVIDIA_API_KEY"),
            base_url=os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
        )
        summarizer_model = "meta/llama-3.1-8b-instruct"
    else:
        summarizer_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        summarizer_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    rolling_summarizer = RollingSummarizer(context, summarizer_client, model=summarizer_model)

    # Pipeline - persister sits right after the LLM so it observes response-end
    # frames; it reads the shared context for message text. The rolling
    # summarizer sits just after it, watching the same response-end frames.
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            persister,
            rolling_summarizer,
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

    session_finalized = False

    async def finalize_session(reason: str) -> None:
        """Run once when a session ends: persist transcript, Weave eval, prompt rewrite."""
        nonlocal session_finalized
        if session_finalized:
            return
        session_finalized = True
        logger.info(f"Finalizing session {session_id} ({reason})")
        try:
            await persister.flush()
            transcript = persister.transcript
            if not transcript:
                logger.warning(f"No transcript to evaluate for session {session_id}")
                return
            save_transcript_file(session_id, transcript)
            save_summaries_file(session_id, rolling_summarizer.summaries)
            # Record the prompt version used for THIS session before any rewrite.
            current_version = improver.load_latest_prompt()[1]
            weave_eval.init_weave()
            scores = await weave_eval.evaluate_session(transcript)
            new_version = await improver.maybe_improve(scores)
            improver.save_report(session_id, scores, current_version, new_version)
        except Exception as e:
            logger.error(f"Error during session finalization: {e}")

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await finalize_session("client disconnected")
        await worker.cancel()

    @worker.event_handler("on_pipeline_finished")
    async def on_pipeline_finished(worker, frame):
        # Idle timeout and transport-side closes cancel the worker without always
        # firing on_client_disconnected (SmallWebRTC skips it when _closing=True).
        await finalize_session(f"pipeline finished ({type(frame).__name__})")

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
