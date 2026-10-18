import argparse
import asyncio
import json
import random
import sys
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import aiohttp
from tqdm import tqdm

API_URL = "https://svenska.se/api/neighbors/saol"
NEIGHBOR_COUNT = 250  # same as svenska.se itself uses
MAX_ATTEMPTS = 5
MAX_CONSECUTIVE_FAILURES = 20

# Sort å ä ö after z, in Swedish order
SWEDISH_ORDER = str.maketrans({"å": "{", "ä": "|", "ö": "}"})


def swedish_key(word: str) -> str:
    return word.lower().translate(SWEDISH_ORDER)


class RateLimiter:
    """Spaces out requests globally, shared by all workers."""

    def __init__(self, per_second: float):
        self.interval = 1.0 / per_second
        self._next = 0.0
        self._lock = asyncio.Lock()

    async def wait(self):
        async with self._lock:
            now = time.monotonic()
            delay = self._next - now
            self._next = max(now, self._next) + self.interval
        if delay > 0:
            await asyncio.sleep(delay)

    def slow_down(self, factor: float = 1.5, max_interval: float = 10.0):
        self.interval = min(self.interval * factor, max_interval)


class TooManyFailures(Exception):
    pass


@dataclass
class State:
    words: set[str]
    results: dict[str, dict]
    cache_file: Path
    errors: dict[str, str] = field(default_factory=dict)
    requests: int = 0
    via_neighbors: int = 0
    consecutive_failures: int = 0
    bar: tqdm | None = None

    def record(self, word: str, status: str, via: str, saol: str | None = None):
        if word in self.results:
            return
        entry = {"word": word, "status": status, "via": via}
        if saol and saol != word:
            entry["saol"] = saol
        self.results[word] = entry
        self.errors.pop(word, None)
        if via == "neighbor":
            self.via_neighbors += 1
        if self.bar is not None:
            self.bar.update(1)
            self.refresh_postfix()
        with self.cache_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def refresh_postfix(self):
        if self.bar is not None:
            self.bar.set_postfix(
                anrop=self.requests, grannar=self.via_neighbors, fel=len(self.errors), refresh=False
            )


def load_words(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    words = data["words"] if isinstance(data, dict) else data
    return sorted({w.strip() for w in words if w.strip()}, key=swedish_key)


def load_cache(path: Path) -> dict[str, dict]:
    results = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                entry = json.loads(line)
                results[entry["word"]] = entry
    return results


async def fetch_term(session: aiohttp.ClientSession, limiter: RateLimiter, state: State, term: str) -> dict:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        await limiter.wait()
        state.requests += 1
        retry_after = None
        try:
            async with session.get(API_URL, params={"term": term, "count": NEIGHBOR_COUNT}) as resp:
                if resp.status == 200:
                    state.consecutive_failures = 0
                    return await resp.json(content_type=None)
                if resp.status == 429:
                    limiter.slow_down()
                if resp.status in (429, 500, 502, 503, 504):
                    header = resp.headers.get("Retry-After", "")
                    retry_after = float(header) if header.replace(".", "", 1).isdigit() else None
                    problem = f"HTTP {resp.status}"
                else:
                    # 4xx other than 429 will not get better by retrying
                    raise aiohttp.ClientResponseError(resp.request_info, resp.history, status=resp.status)
        except (TimeoutError, aiohttp.ClientConnectionError) as e:
            problem = type(e).__name__

        state.consecutive_failures += 1
        if state.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            raise TooManyFailures(f"{state.consecutive_failures} misslyckade anrop i rad, senast: {problem}")
        if attempt == MAX_ATTEMPTS:
            raise RuntimeError(f"gav upp efter {MAX_ATTEMPTS} försök ({problem})")
        backoff = retry_after if retry_after is not None else 2**attempt + random.uniform(0, 1)
        await asyncio.sleep(backoff)
    raise AssertionError("unreachable")


def apply_response(state: State, word: str, data: dict):
    current = data.get("current") or word
    if not data.get("exists"):
        state.record(word, "invalid", "direct")
    elif current == word:
        state.record(word, "valid", "direct")
    elif current.lower() == word.lower():
        state.record(word, "capitalized", "direct", current)
    else:
        state.record(word, "variant", "direct", current)

    # Neighbors are SAOL headwords: an exact match confirms one of our words
    for neighbor in (*data.get("before", []), *data.get("after", [])):
        if neighbor in state.words and neighbor not in state.results:
            state.record(neighbor, "valid", "neighbor")


async def worker(chunks: asyncio.Queue, session, limiter: RateLimiter, state: State):
    while True:
        try:
            chunk = chunks.get_nowait()
        except asyncio.QueueEmpty:
            return
        for word in chunk:
            # Probably already confirmed by an earlier answer's neighbor list
            if word in state.results:
                continue
            try:
                data = await fetch_term(session, limiter, state, word)
            except TooManyFailures:
                raise
            except Exception as e:  # noqa: BLE001 - one bad word should not stop the run
                state.errors[word] = str(e)
                state.refresh_postfix()
                continue
            apply_response(state, word, data)


def write_output(path: Path, source: Path, words: list[str], state: State):
    buckets: dict[str, list] = {"valid": [], "capitalized": [], "variant": [], "invalid": []}
    for word in words:
        entry = state.results.get(word)
        if not entry:
            continue
        if entry["status"] in ("capitalized", "variant"):
            buckets[entry["status"]].append({"word": word, "saol": entry["saol"]})
        else:
            buckets[entry["status"]].append(word)

    output = {
        "source": str(source),
        "checked_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "counts": {k: len(v) for k, v in buckets.items()}
        | {"errors": len(state.errors), "unchecked": len(words) - len(state.results)},
        **buckets,
        "errors": state.errors,
    }
    path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    return output["counts"]


async def run(args):
    source = Path(args.input)
    words = load_words(source)
    if args.limit:
        words = words[: args.limit]

    cache_file = Path(args.cache or source.with_suffix(".saol-cache.jsonl"))
    output_file = Path(args.output or source.with_suffix(".saol.json"))
    word_set = set(words)
    cached = {w: e for w, e in load_cache(cache_file).items() if w in word_set}
    state = State(words=word_set, results=cached, cache_file=cache_file)

    todo = [w for w in words if w not in state.results]
    print(f"{len(words)} ord i {source.name}, {len(cached)} redan i cachen, {len(todo)} kvar att kolla")

    if todo:
        # Contiguous alphabetical chunks so parallel workers do not overlap,
        # several per worker so nobody sits idle at the end
        n_chunks = max(1, args.concurrency * 8)
        size = -(-len(todo) // n_chunks)
        chunks: asyncio.Queue = asyncio.Queue()
        for i in range(0, len(todo), size):
            chunks.put_nowait(todo[i : i + size])

        limiter = RateLimiter(args.rate)
        timeout = aiohttp.ClientTimeout(total=30)
        headers = {"Accept": "application/json"}
        connector = aiohttp.TCPConnector(limit=args.concurrency)

        async with aiohttp.ClientSession(headers=headers, timeout=timeout, connector=connector) as session:
            with tqdm(total=len(words), initial=len(cached), unit="ord", dynamic_ncols=True) as bar:
                state.bar = bar
                try:
                    await asyncio.gather(
                        *(worker(chunks, session, limiter, state) for _ in range(args.concurrency))
                    )
                except TooManyFailures as e:
                    tqdm.write(f"Avbryter: {e}. Servern verkar inte må bra, försök igen senare.", file=sys.stderr)
                finally:
                    state.bar = None

    counts = write_output(output_file, source, words, state)
    print(f"\nResultat sparat i {output_file}")
    for name, n in counts.items():
        print(f"  {name:12} {n}")
    if state.requests:
        print(f"  ({state.requests} anrop, {state.via_neighbors} ord bekräftades via grannlistor)")

    if args.valid_out:
        valid = [w for w in words if state.results.get(w, {}).get("status") == "valid"]
        Path(args.valid_out).write_text(
            json.dumps({"words": valid}, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"Giltiga ord sparade i {args.valid_out}")

    if counts["errors"] or counts["unchecked"]:
        print("Kör samma kommando igen för att försöka med de som saknas.")


def main():
    parser = argparse.ArgumentParser(description="Kontrollera ord mot SAOL via svenska.se")
    parser.add_argument("-i", "--input", help='JSON-fil med {"words": [...]} eller en lista')
    parser.add_argument("-o", "--output", help="resultatfil (standard: <input>.saol.json)")
    parser.add_argument("--valid-out", help='skriv giltiga ord som {"words": [...]} hit')
    parser.add_argument("--cache", help="cachefil (standard: <input>.saol-cache.jsonl)")
    parser.add_argument("--concurrency", type=int, default=2, help="parallella anrop (standard 2)")
    parser.add_argument("--rate", type=float, default=2.0, help="max anrop per sekund (standard 2)")
    parser.add_argument("--limit", type=int, help="kolla bara de N första orden (för test)")
    args = parser.parse_args()

    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        print("\nAvbrutet. Allt hittills är sparat i cachen; kör igen för att fortsätta.")


if __name__ == "__main__":
    main()
