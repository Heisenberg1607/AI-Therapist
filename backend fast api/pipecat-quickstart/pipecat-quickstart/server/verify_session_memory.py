"""Offline verification for HydraDB session-cache memory injection (no network).

Drives SessionMemory + MemoryInjector with a fake HydraDB client and asserts the
optimized retrieval and prompt-injection behavior:

  - session load retrieves profile, relevant, and recent memories
  - background session load does not block the greeting
  - first real user turn waits briefly and injects memory for the second response
  - memories are scoped to the authenticated user's sub_tenant_id
  - no HydraDB query happens on ordinary turns
  - cached memories are injected into the prompt as hidden context
  - fake LLM output changes when memory context is present
  - refreshes are scheduled in the background without blocking responses

Run from this directory:
    uv run python verify_session_memory.py
    #   or:  ./.venv/bin/python verify_session_memory.py

Exit code 0 = all checks passed, 1 = a check failed. This is fully offline, so it
needs no API key.
"""

import asyncio
import sys
import time

import bot
import hydra_memory
from hydra_memory import SessionMemory


class Checks:
    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0

    def check(self, label: str, ok: bool, detail: str = "") -> None:
        tag = "PASS" if ok else "FAIL"
        suffix = f"  ({detail})" if detail else ""
        print(f"  [{tag}] {label}{suffix}")
        if ok:
            self.passed += 1
        else:
            self.failed += 1


class FakeClient:
    """Stand-in for HydraMemory: counts recalls, optional latency, toggleable."""

    def __init__(
        self,
        enabled: bool = True,
        delay: float = 0.0,
        memories: list[str] | None = None,
    ) -> None:
        self.enabled = enabled
        self.tenant_id = "ai-therapist"
        self.delay = delay
        self.calls = 0
        self.uids: list[str] = []
        self.queries: list[str] = []
        self.max_results: list[int] = []
        self.memories = (
            memories
            if memories is not None
            else [
                "client feels recurring exam stress; copes by journaling at night",
                "client prefers gentle follow-up questions and practical grounding",
            ]
        )

    async def recall(self, uid, query, *, max_results=5, recency_bias=0.0):
        self.calls += 1
        self.uids.append(uid)
        self.queries.append(query)
        self.max_results.append(max_results)
        if self.delay:
            await asyncio.sleep(self.delay)
        return self.memories[:max_results]


class FakeContext:
    def __init__(self, messages):
        self._m = list(messages)

    def get_messages(self):
        return list(self._m)

    def set_messages(self, m):
        self._m = list(m)


def fake_llm_response(messages: list[dict]) -> str:
    prompt_text = "\n".join(str(m.get("content", "")) for m in messages)
    if "journaling at night" in prompt_text:
        return "It may help to lean on that journaling rhythm tonight."
    return "Tell me a bit more about what is going on."


async def _cancel_refresh(sm: SessionMemory) -> None:
    task = sm._refresh_task
    if task and not task.done():
        task.cancel()
        try:
            await task
        except BaseException:
            pass


async def run(checks: Checks) -> None:
    # 1. Session load retrieves profile, relevant, and recent memory buckets.
    fc = FakeClient()
    sm = SessionMemory(client=fc)
    await sm.initialize("user-1")
    checks.check("session load retrieves memories", len(sm.memories) >= 2, f"{len(sm.memories)} memories")
    checks.check("session load issues 3 recalls", fc.calls == 3, f"calls={fc.calls}")
    checks.check("session load scoped to user sub_tenant", fc.uids == ["user-1", "user-1", "user-1"])
    checks.check("session load caps each recall to top 5", fc.max_results == [5, 5, 5])

    # 2. Background load starts after the greeting and can be used by the second response.
    bg_client = FakeClient(delay=0.2)
    bg_sm = SessionMemory(client=bg_client)
    t0 = time.monotonic()
    bg_sm.start_background_load("user-bg")
    start_elapsed_ms = (time.monotonic() - t0) * 1000
    checks.check("background load start does not block greeting", start_elapsed_ms < 50, f"{start_elapsed_ms:.0f}ms")

    bg_ctx = FakeContext(
        [
            {"role": "system", "content": "MAIN PROMPT"},
            {"role": "user", "content": "i feel stressed right now"},
        ]
    )
    await bot.MemoryInjector(bg_ctx, bg_sm, "user-bg", bot.SESSION_START_MESSAGE)._before_llm_run()
    bg_blocks = [
        i
        for i, m in enumerate(bg_ctx.get_messages())
        if m["content"].startswith(bot.MemoryInjector.MEMORY_PREFIX)
    ]
    checks.check("second response waits and injects memory", bg_blocks == [1], f"indices={bg_blocks}")
    checks.check("background load scoped to user", bg_client.uids == ["user-bg", "user-bg", "user-bg"])

    # 3. Ordinary real turns inject from cache and do not hit HydraDB.
    user_msg = "i feel stressed about my exam"
    ctx = FakeContext(
        [
            {"role": "system", "content": "MAIN PROMPT"},
            {"role": "system", "content": "Session summary so far: x"},
            {"role": "user", "content": user_msg},
        ]
    )
    before = fc.calls
    inj = bot.MemoryInjector(ctx, sm, "user-1", bot.SESSION_START_MESSAGE)
    await inj._before_llm_run()
    await inj._before_llm_run()  # re-run must replace, not duplicate
    blocks = [
        i
        for i, m in enumerate(ctx.get_messages())
        if m["content"].startswith(bot.MemoryInjector.MEMORY_PREFIX)
    ]
    checks.check("ordinary turns use cache only", fc.calls == before, f"calls={fc.calls}")
    checks.check("injector: single block, below the summary (idx 2)", blocks == [2], f"indices={blocks}")
    block = ctx.get_messages()[blocks[0]]["content"] if blocks else ""
    checks.check("memory block is hidden", "hidden; do not reveal" in block)
    checks.check("retrieved memories injected into prompt", "journaling at night" in block)

    # 4. Fake LLM output changes because the memory context is present.
    no_memory_response = fake_llm_response(
        [{"role": "system", "content": "MAIN PROMPT"}, {"role": "user", "content": user_msg}]
    )
    memory_response = fake_llm_response(ctx.get_messages())
    checks.check("LLM receives memory context", "journaling rhythm" in memory_response)
    checks.check("response changes based on memory", memory_response != no_memory_response)

    # 5. Empty cache removes stale memory context and continues normally.
    empty_sm = SessionMemory(client=FakeClient(memories=[]))
    await empty_sm.initialize("user-1")
    await bot.MemoryInjector(ctx, empty_sm, "user-1", bot.SESSION_START_MESSAGE)._before_llm_run()
    blocks = [
        i
        for i, m in enumerate(ctx.get_messages())
        if m["content"].startswith(bot.MemoryInjector.MEMORY_PREFIX)
    ]
    checks.check("empty cache removes stale memory block", blocks == [], f"indices={blocks}")

    # 6. Refreshes are scheduled in the background and do not block the turn.
    slow = FakeClient(delay=1.0)
    sm2 = SessionMemory(client=slow)
    await sm2.initialize("user-2")
    t0 = time.monotonic()
    await sm2.maybe_refresh_for_turn("user-2", "last time we talked about exams", 1)
    elapsed_ms = (time.monotonic() - t0) * 1000
    await _cancel_refresh(sm2)
    checks.check("background refresh does not block response", elapsed_ms < 200, f"{elapsed_ms:.0f}ms")

    # 7. Formatter returns no block for empty memory and keeps context bounded.
    checks.check("formatter skips empty memories", hydra_memory.format_memory_context([]) == "")
    formatted = hydra_memory.format_memory_context(["client journals at night"])
    checks.check("formatter guides follow-up questions", "follow-up questions" in formatted)
    checks.check("formatter guides natural pattern connection", "known patterns" in formatted)
    long_memories = ["x" * 1000 for _ in range(10)]
    bounded = hydra_memory.format_memory_context(long_memories)
    checks.check("formatter trims oversized memory context", len(bounded) < 1600, f"{len(bounded)} chars")


async def main() -> int:
    checks = Checks()
    print("== Session-memory cache verification (offline) ==")
    await run(checks)
    print(f"\n==> {checks.passed} passed, {checks.failed} failed")
    return 1 if checks.failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
