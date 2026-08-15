#!/usr/bin/env python3
"""Bounded wait for PostgreSQL connectivity without printing credentials."""

from __future__ import annotations

import argparse
import os
import sys
import time

import psycopg


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout", type=int, default=60, help="Maximum seconds to wait")
    parser.add_argument("--interval", type=float, default=2.0, help="Seconds between attempts")
    args = parser.parse_args()

    host = os.environ.get("POSTGRES_HOST", "127.0.0.1")
    port = os.environ.get("POSTGRES_PORT", "5432")
    dbname = os.environ.get("POSTGRES_DB", "nelna_fg")
    user = os.environ.get("POSTGRES_USER", "nelna_fg")
    password = os.environ.get("POSTGRES_PASSWORD", "")

    deadline = time.monotonic() + args.timeout
    attempt = 0
    while time.monotonic() < deadline:
        attempt += 1
        try:
            with psycopg.connect(
                host=host,
                port=port,
                dbname=dbname,
                user=user,
                password=password,
                connect_timeout=3,
            ) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            print(f"PostgreSQL is ready after {attempt} attempt(s).")
            return 0
        except Exception as exc:  # noqa: BLE001 — do not print connection strings
            remaining = max(0, int(deadline - time.monotonic()))
            print(
                f"Waiting for PostgreSQL (attempt {attempt}, {remaining}s remaining): "
                f"{type(exc).__name__}",
                file=sys.stderr,
            )
            time.sleep(args.interval)

    print("ERROR: Timed out waiting for PostgreSQL.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
