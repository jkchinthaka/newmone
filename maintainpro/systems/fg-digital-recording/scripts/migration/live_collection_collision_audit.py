#!/usr/bin/env python
"""READ-ONLY live collection collision audit against company MongoDB.

SAFETY:
  - list_collection_names / list_database_names / server_info ONLY
  - NEVER insert/update/delete
  - NEVER create indexes or collections
  - NEVER run Django migrations
  - Does NOT execute automatically against company server

Authorized later run (example — credentials from vault/env only):

  $env:MONGODB_URI = "<from vault>"
  $env:MONGODB_DATABASE = "mgintginpro_prod"
  uv run python scripts/migration/live_collection_collision_audit.py --read-only

Default planned FG names are loaded from Django with fg_ prefix (no writes).
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="READ-ONLY Mongo collection collision audit")
    parser.add_argument("--read-only", action="store_true", required=True)
    parser.add_argument("--uri-env", default="MONGODB_URI")
    parser.add_argument("--database-env", default="MONGODB_DATABASE")
    parser.add_argument("--database", default=None, help="Override DB name (default env)")
    parser.add_argument(
        "--output",
        default="docs/migration/LIVE_COLLECTION_COLLISION_AUDIT.md",
    )
    parser.add_argument("--settings", default="config.settings.test")
    parser.add_argument(
        "--allow-production-database",
        action="store_true",
        help="Required confirmation when database name is mgintginpro_prod",
    )
    args = parser.parse_args()

    if not args.read_only:
        print("Refusing to run without --read-only", file=sys.stderr)
        return 2

    uri = os.environ.get(args.uri_env)
    db_name = args.database or os.environ.get(args.database_env)
    if not uri or not db_name:
        print(
            f"Set {args.uri_env} and {args.database_env} (or --database). No defaults for URI.",
            file=sys.stderr,
        )
        return 2

    if db_name == "mgintginpro_prod" and not args.allow_production_database:
        print(
            "Refusing mgintginpro_prod without --allow-production-database "
            "(read-only still; explicit operator confirmation required).",
            file=sys.stderr,
        )
        return 2

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", args.settings)
    import django

    django.setup()
    from apps.core.db_namespace import build_collection_specs

    planned = {s.mongo_collection for s in build_collection_specs(prefix="fg_")}

    from pymongo import MongoClient
    from pymongo.errors import PyMongoError

    client: MongoClient | None = None
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=8000)
        # READ-ONLY probes only
        server_info = client.server_info()
        db = client[db_name]
        existing = sorted(db.list_collection_names())
        collisions = sorted(set(existing) & planned)
        version = server_info.get("version", "unknown")

        # Topology (read-only hello/isMaster)
        hello = db.command("hello")
        topology = "unknown"
        if hello.get("msg") == "isdbgrid":
            topology = "sharded"
        elif hello.get("setName"):
            topology = f"replicaSet:{hello.get('setName')}"
        elif hello.get("isWritablePrimary") or hello.get("ismaster"):
            topology = "standalone-or-primary"

        status = (
            "SAFE — NO EXACT COLLECTION COLLISION"
            if not collisions
            else "CUTOVER BLOCKED — COLLECTION COLLISION"
        )

        stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        lines = [
            "# Live Collection Collision Audit (READ-ONLY)",
            "",
            f"**Generated (UTC):** {stamp}  ",
            "",
            "```text",
            f"Mongo version: {version}",
            f"Topology: {topology}",
            f"Database: {db_name}",
            f"Existing collection count: {len(existing)}",
            f"Planned FG collection count: {len(planned)}",
            f"Exact name collisions: {len(collisions)}",
            f"Classification: {status}",
            "```",
            "",
            "## Existing collections",
            "",
        ]
        for name in existing:
            lines.append(f"- `{name}`")
        lines.extend(["", "## Exact collisions", ""])
        if collisions:
            for name in collisions:
                lines.append(f"- `{name}`")
        else:
            lines.append("_None._")
        lines.extend(
            [
                "",
                "## Safety attestation",
                "",
                "- Operations used: `server_info`, `hello`, `list_collection_names` only",
                "- No inserts, updates, deletes, index builds, or migrations",
                "",
            ]
        )
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"WROTE={out}")
        print(f"CLASSIFICATION={status}")
        print(f"COLLISIONS={len(collisions)}")
        return 0 if not collisions else 1
    except PyMongoError as exc:
        print(f"Mongo read-only audit failed: {exc}", file=sys.stderr)
        return 3
    finally:
        if client is not None:
            client.close()


if __name__ == "__main__":
    raise SystemExit(main())
