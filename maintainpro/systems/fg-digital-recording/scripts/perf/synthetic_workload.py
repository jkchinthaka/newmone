"""Synthetic workload driver for Phase 19 performance smoke (no external locust dependency).

Exercises login + health endpoints with concurrent workers against a target base URL.
Not a certification load test — evidence for full load remains operator/staging owned.
"""

from __future__ import annotations

import argparse
import statistics
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse


def _require_http_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Only http/https URLs are permitted.")
    return url


def timed_get(url: str, timeout: float) -> tuple[int, float]:
    started = time.perf_counter()
    try:
        safe_url = _require_http_url(url)
        with urllib.request.urlopen(safe_url, timeout=timeout) as resp:  # noqa: S310  # nosec B310
            code = getattr(resp, "status", 200)
    except urllib.error.HTTPError as exc:
        code = exc.code
    except Exception:  # noqa: BLE001
        return 0, (time.perf_counter() - started) * 1000
    return int(code), (time.perf_counter() - started) * 1000


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--requests", type=int, default=40)
    parser.add_argument("--timeout", type=float, default=5.0)
    args = parser.parse_args()
    url = args.base_url.rstrip("/") + "/health/live/"
    latencies: list[float] = []
    codes: list[int] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(timed_get, url, args.timeout) for _ in range(args.requests)]
        for fut in as_completed(futures):
            code, ms = fut.result()
            codes.append(code)
            latencies.append(ms)
    ok = sum(1 for c in codes if c == 200)
    print(
        {
            "target": url,
            "requests": args.requests,
            "ok": ok,
            "p50_ms": round(statistics.median(latencies), 2),
            "p95_ms": round(sorted(latencies)[max(0, int(len(latencies) * 0.95) - 1)], 2),
            "max_ms": round(max(latencies), 2),
        }
    )
    return 0 if ok == args.requests else 1


if __name__ == "__main__":
    raise SystemExit(main())
