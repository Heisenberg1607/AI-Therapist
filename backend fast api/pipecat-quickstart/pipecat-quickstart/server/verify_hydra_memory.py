"""Local verification for the HydraDB memory layer.

Proves, against the real HydraDB API, that:
  1. writing a distilled memory works,
  2. recalling it works,
  3. two different users (sub_tenants) cannot see each other's memories.

It also runs offline checks of the pure helpers (no network needed).

Usage (from this directory):

    cp .env.example .env          # then paste HYDRA_DB_API_KEY (same value as .mcp.json)
    uv run python verify_hydra_memory.py
    #   or:  ./.venv/bin/python verify_hydra_memory.py

Exit code 0 = all checks passed (or cleanly skipped when no API key); 1 = a check failed.
The two synthetic users live under throwaway sub_tenants and are deleted at the end, so
this never touches real users' memory spaces.
"""

import asyncio
import sys

from dotenv import load_dotenv

from hydra_memory import HydraMemory, format_memories_block, is_trivial_memory

load_dotenv(override=True)

# Two synthetic, clearly-labelled users. Distinct, unmistakable themes + unique markers
# so the isolation assertions are robust (chunk_content is returned verbatim on recall).
USER_A = "verify-user-a-zeta"
USER_B = "verify-user-b-zeta"

MEMORY_A = (
    "Session summary: the client keeps feeling recurring stress about final exams and "
    "upcoming job interviews. They cope by journaling at night and going for long runs. "
    "Their goal is to feel calmer before presentations. Unique marker: alphacode7731."
)
MEMORY_B = (
    "Session summary: the client is grieving the recent loss of their cat and feels lonely "
    "in the evenings. They cope by calling their sister and baking bread. Their goal is to "
    "rebuild a daily routine. Unique marker: bravocode9920."
)

MARKER_A = "alphacode7731"
MARKER_B = "bravocode9920"


class Checks:
    """Tiny PASS/FAIL recorder."""

    def __init__(self) -> None:
        self.failed = 0
        self.passed = 0

    def check(self, label: str, ok: bool, detail: str = "") -> None:
        tag = "PASS" if ok else "FAIL"
        suffix = f"  ({detail})" if detail else ""
        print(f"  [{tag}] {label}{suffix}")
        if ok:
            self.passed += 1
        else:
            self.failed += 1


def run_offline_checks(checks: Checks) -> None:
    print("\n== Offline checks (no network) ==")
    checks.check("is_trivial_memory('') is True", is_trivial_memory("") is True)
    checks.check("is_trivial_memory('too short') is True", is_trivial_memory("too short") is True)
    checks.check(
        "is_trivial_memory(long text) is False",
        is_trivial_memory(MEMORY_A) is False,
    )
    checks.check("format_memories_block([]) == ''", format_memories_block([]) == "")
    block = format_memories_block(["likes journaling", "stressed about exams"])
    checks.check(
        "format_memories_block(...) renders a bullet block",
        block.startswith("What you remember") and "- likes journaling" in block,
        detail=f"{len(block)} chars",
    )


def _joined(memories: list[str]) -> str:
    return "\n".join(memories).lower()


def _memory_id(record: dict) -> str | None:
    for key in ("memory_id", "id", "uuid", "memoryId"):
        value = record.get(key)
        if isinstance(value, str) and value:
            return value
    return None


async def _poll_recall(
    client: HydraMemory, sub_tenant: str, query: str, *, attempts: int = 25, delay: float = 6.0
) -> list[str]:
    """Recall with retries — HydraDB ingestion (infer) is eventual.

    The infer pipeline indexes a freshly-written memory asynchronously; in practice
    it takes ~30s before a new memory becomes recallable. Poll generously (default
    ~150s) so this check doesn't report a false failure during normal ingestion lag.
    """
    memories: list[str] = []
    for i in range(1, attempts + 1):
        memories = await client.recall(sub_tenant, query, max_results=5)
        if memories:
            return memories
        print(f"    …recall attempt {i}/{attempts} empty, retrying in {delay:.0f}s")
        await asyncio.sleep(delay)
    return memories


async def run_online_checks(client: HydraMemory, checks: Checks) -> None:
    print("\n== Online checks (HydraDB) ==")
    print(f"  tenant_id = {client.tenant_id!r}")
    print(f"  sub_tenant A = {USER_A!r}")
    print(f"  sub_tenant B = {USER_B!r}")

    # 1. Write one distilled memory per user.
    print("\n-- Writing memories --")
    wrote_a = await client.write_memory(
        USER_A, MEMORY_A, title="Verify A", source_id="verify-a", category="session_summary"
    )
    wrote_b = await client.write_memory(
        USER_B, MEMORY_B, title="Verify B", source_id="verify-b", category="session_summary"
    )
    checks.check("write memory for user A", wrote_a)
    checks.check("write memory for user B", wrote_b)

    # 2. Recall each user (with retries for eventual ingestion).
    print("\n-- Recalling memories --")
    recall_a = await _poll_recall(client, USER_A, "what stresses this person and how do they cope?")
    recall_b = await _poll_recall(client, USER_B, "what stresses this person and how do they cope?")
    checks.check("recall returns memories for user A", bool(recall_a), detail=f"{len(recall_a)} found")
    checks.check("recall returns memories for user B", bool(recall_b), detail=f"{len(recall_b)} found")

    text_a, text_b = _joined(recall_a), _joined(recall_b)

    # 3. Each user recalls their own theme.
    checks.check("user A recalls A's own memory", MARKER_A in text_a)
    checks.check("user B recalls B's own memory", MARKER_B in text_b)

    # 4. ISOLATION — neither user sees the other's memory.
    print("\n-- Isolation --")
    checks.check("user A does NOT see B's memory", MARKER_B not in text_a)
    checks.check("user B does NOT see A's memory", MARKER_A not in text_b)

    # Cleanup — delete the synthetic memories (best-effort).
    print("\n-- Cleanup --")
    for sub_tenant in (USER_A, USER_B):
        records = await client.list_memories(sub_tenant)
        deleted = 0
        for record in records:
            mem_id = _memory_id(record)
            if mem_id and await client.delete_memory(sub_tenant, mem_id):
                deleted += 1
        print(f"    deleted {deleted} memory record(s) for {sub_tenant}")


async def main() -> int:
    client = HydraMemory()  # built after load_dotenv, so it picks up .env

    checks = Checks()
    run_offline_checks(checks)

    if not client.enabled:
        print(
            "\n[SKIP] HYDRA_DB_API_KEY not set — skipping online checks.\n"
            "       Set it in .env to run the write/recall/isolation verification."
        )
    else:
        try:
            await run_online_checks(client, checks)
        finally:
            await client.aclose()

    print(f"\n==> {checks.passed} passed, {checks.failed} failed")
    return 1 if checks.failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
