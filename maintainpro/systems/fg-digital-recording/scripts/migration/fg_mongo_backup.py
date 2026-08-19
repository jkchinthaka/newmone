#!/usr/bin/env python
"""FG-only MongoDB backup for shared-database deployments.

Dumps ONLY collections whose names begin with ``fg_``.

Safety:
  * Refuses to target the company production database name for *any* write
    (this tool only dumps; restore has its own guard).
  * Never includes MaintainPro / non-``fg_`` collections.
  * Requires an explicit --database; defaults must be overridden carefully.

Usage (isolated POC)::

  set MONGODB_URI=mongodb://127.0.0.1:27027/?replicaSet=nelnaPocRs&directConnection=true
  uv run python scripts/migration/fg_mongo_backup.py \\
    --uri \"%MONGODB_URI%\" --database fg_same_db_poc --out .mongo_fg_backup_poc

Does NOT authorize production execution against maintainpro_prod.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


PRODUCTION_DB_DEFAULT = "maintainpro_prod"
FG_PREFIX = "fg_"


def _list_fg_collections(*, uri: str, database: str) -> list[str]:
    from pymongo import MongoClient

    client = MongoClient(uri, serverSelectionTimeoutMS=8000)
    try:
        names = sorted(
            n
            for n in client[database].list_collection_names()
            if n.startswith(FG_PREFIX) and not n.startswith("system.")
        )
    finally:
        client.close()
    return names


def main() -> int:
    parser = argparse.ArgumentParser(description="FG-only mongodump wrapper")
    parser.add_argument("--uri", required=True, help="MongoDB URI (no credentials in source)")
    parser.add_argument("--database", required=True, help="Logical database name")
    parser.add_argument(
        "--out",
        required=True,
        type=Path,
        help="Output directory for mongodump",
    )
    parser.add_argument(
        "--production-database-name",
        default=PRODUCTION_DB_DEFAULT,
        help="Name that must never be the restore target (documented only here)",
    )
    parser.add_argument(
        "--allow-production-read",
        action="store_true",
        help="Allow dump FROM the production database name (read-only). Default: refuse.",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.database == args.production_database_name and not args.allow_production_read:
        print(
            f"REFUSED: dumping database {args.database!r} requires --allow-production-read "
            "(and separate written authorization). Prefer isolated POC databases.",
            file=sys.stderr,
        )
        return 2

    collections = _list_fg_collections(uri=args.uri, database=args.database)
    if not collections:
        print(f"No {FG_PREFIX}* collections found in {args.database!r}", file=sys.stderr)
        return 1

    non_fg_probe = []
    from pymongo import MongoClient

    client = MongoClient(args.uri, serverSelectionTimeoutMS=8000)
    try:
        non_fg_probe = sorted(
            n
            for n in client[args.database].list_collection_names()
            if not n.startswith(FG_PREFIX) and not n.startswith("system.")
        )
    finally:
        client.close()

    manifest = {
        "database": args.database,
        "fg_collections": collections,
        "ignored_non_fg_collections": non_fg_probe,
        "fg_count": len(collections),
        "ignored_non_fg_count": len(non_fg_probe),
    }
    print(json.dumps(manifest, indent=2))

    if args.dry_run:
        print("DRY_RUN: no mongodump executed")
        return 0

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "fg_backup_manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )

    # Prefer one dump invocation with multiple --collection flags when available.
    cmd = [
        "mongodump",
        f"--uri={args.uri}",
        f"--db={args.database}",
        f"--out={str(args.out)}",
    ]
    for name in collections:
        cmd.extend(["--collection", name])

    print("RUNNING:", " ".join(cmd[:4]), f"... ({len(collections)} collections)")
    completed = subprocess.run(cmd, check=False)
    if completed.returncode != 0:
        print(f"mongodump failed with exit {completed.returncode}", file=sys.stderr)
        return completed.returncode
    print(f"OK: FG-only dump written under {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
