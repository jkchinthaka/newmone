#!/usr/bin/env python
"""READ-ONLY MongoDB topology checker (no writes).

Reports version, standalone/replica-set/sharded, transaction capability signals.

Example (isolated POC):

  $env:MONGODB_URI = "mongodb://127.0.0.1:27027/?replicaSet=nelnaPocRs&directConnection=true"
  uv run python scripts/migration/mongo_topology_audit.py --read-only

Company server (authorized later only):

  $env:MONGODB_URI = "<from vault pointing at 127.0.0.1:27018>"
  uv run python scripts/migration/mongo_topology_audit.py --read-only --allow-production-host
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse


def main() -> int:
    parser = argparse.ArgumentParser(description="READ-ONLY Mongo topology audit")
    parser.add_argument("--read-only", action="store_true", required=True)
    parser.add_argument("--uri-env", default="MONGODB_URI")
    parser.add_argument(
        "--output",
        default="docs/migration/MONGO_TOPOLOGY_AUDIT.md",
    )
    parser.add_argument(
        "--allow-production-host",
        action="store_true",
        help="Required if URI host is 127.0.0.1 and port 27018 (company target)",
    )
    args = parser.parse_args()

    if not args.read_only:
        print("Refusing without --read-only", file=sys.stderr)
        return 2

    uri = os.environ.get(args.uri_env)
    if not uri:
        print(f"Set {args.uri_env}", file=sys.stderr)
        return 2

    parsed = urlparse(uri.split(",")[0])
    host = parsed.hostname or ""
    port = parsed.port
    if host in {"127.0.0.1", "localhost"} and port == 27018 and not args.allow_production_host:
        print(
            "Refusing company host:port 127.0.0.1:27018 without --allow-production-host",
            file=sys.stderr,
        )
        return 2

    from pymongo import MongoClient
    from pymongo.errors import PyMongoError

    client = None
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=8000)
        info = client.server_info()
        admin = client.admin
        hello = admin.command("hello")
        version = info.get("version", "unknown")
        max_wire = info.get("maxWireVersion", "unknown")
        min_wire = info.get("minWireVersion", "unknown")

        if hello.get("msg") == "isdbgrid":
            topology = "sharded"
            rs_name = None
        elif hello.get("setName"):
            topology = "replica set"
            rs_name = hello.get("setName")
        else:
            topology = "standalone"
            rs_name = None

        # Transactions require replica set or sharded cluster (not standalone)
        transactions = topology in {"replica set", "sharded"}
        sessions = True  # modern servers; presence of hello is enough signal for audit

        stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        block_note = ""
        if topology == "standalone":
            block_note = (
                "\n\n**WARNING:** Standalone topology cannot provide multi-document "
                "transactions. If FG requires multi-doc transaction semantics, "
                "classification remains BLOCKED until an approved replica-set topology "
                "exists. Do NOT modify company topology automatically.\n"
            )

        body = f"""# MongoDB Topology Audit (READ-ONLY)

**Generated (UTC):** {stamp}

```text
MongoDB version: {version}
standalone / replica set / sharded: {topology}
replica set name: {rs_name or "(none)"}
transaction capability: {"YES (topology supports)" if transactions else "NO (standalone)"}
session capability: {"YES" if sessions else "UNKNOWN"}
wire version: min={min_wire} max={max_wire}
host (from URI): {host}:{port}
```
{block_note}
## Safety attestation

- Commands used: `server_info`, `hello` only
- No writes, index builds, or topology changes
"""
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(body, encoding="utf-8")
        print(f"WROTE={out}")
        print(f"TOPOLOGY={topology}")
        print(f"TRANSACTIONS={'yes' if transactions else 'no'}")
        return 0
    except PyMongoError as exc:
        print(f"Topology audit failed: {exc}", file=sys.stderr)
        return 3
    finally:
        if client is not None:
            client.close()


if __name__ == "__main__":
    raise SystemExit(main())
