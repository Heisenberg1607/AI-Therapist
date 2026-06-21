import os

from dotenv import load_dotenv
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.runner.types import (
    DailyRunnerArguments,
    RunnerArguments,
    SmallWebRTCRunnerArguments,
)
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams, DailyTransport
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

load_dotenv(override=True)


SYSTEM_PROMPT = (
    "You are a friendly voice assistant. Keep your answers short, warm, and "
    "conversational -- one or two sentences -- since they will be spoken aloud."
)


async def run_bot(transport: BaseTransport):
    """Build the pipeline and run the conversation."""

    
    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))

    llm = OpenAILLMService(
        api_key=os.getenv("OPENAI_API_KEY"),
        settings=OpenAILLMService.Settings(model=os.getenv("OPENAI_MODEL", "gpt-4o-mini")),
    )

    tts = ElevenLabsTTSService(
        api_key=os.getenv("ELEVENLABS_API_KEY"),
        voice_id=os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb"),
    )

    context = LLMContext(messages=[{"role": "system", "content": SYSTEM_PROMPT}])
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(context)

    
    pipeline = Pipeline( 
        [
            transport.input(),     # audio comes IN from the user
            stt,                   # speech  -> text
            user_aggregator,       # collect text into one finished user message
            llm,                   # text    -> reply (streamed)
            tts,                   # reply   -> speech
            transport.output(),    # audio goes OUT to the user
            assistant_aggregator,  # record the reply back into memory
        ]
    )

    
    worker = PipelineWorker(pipeline, params=PipelineParams(enable_metrics=True))

    
    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")
        context.add_message({"role": "user", "content": "Greet me in one short sentence."})
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await worker.cancel()

    # 6. Run it (blocks here until the call ends).
    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)
    await runner.run()


async def bot(runner_args: RunnerArguments):
    """Entry point the Pipecat runner calls. Pick a transport, then run the bot."""
    
    vad = SileroVADAnalyzer()

    if isinstance(runner_args, DailyRunnerArguments):
        transport = DailyTransport(
            runner_args.room_url,
            runner_args.token,
            "Simple Bot",
            params=DailyParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                vad_analyzer=vad,
            ),
        )
    elif isinstance(runner_args, SmallWebRTCRunnerArguments):
        transport = SmallWebRTCTransport(
            webrtc_connection=runner_args.webrtc_connection,
            params=TransportParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                vad_analyzer=vad,
            ),
        )
    else:
        logger.error(f"Unsupported runner arguments: {type(runner_args)}")
        return

    await run_bot(transport)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()