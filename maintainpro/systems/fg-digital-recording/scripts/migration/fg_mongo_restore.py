#!/usr/bin/env python
"""FG-only MongoDB restore for shared-database deployments.

Restores ONLY ``fg_*`` BSON dumps into an isolated target database.

Safety:
  * REFUSES target database name == maintainpro_prod (or configured production name)
  * REFUSES any dump artifact whose collection name does not start with ``fg_``
  * Never restores MaintainPro collections

Usage (isolated)::

  uv run python scripts/migration/fg_mongo_restore.py \\
    --uri \"%MONGODB_URI%\" \\
    --target-database fg_same_db_poc_restore \\
    --dump-dir .mongo_fg_backup_poc/fg_same_db_poc
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


PRODUCTION_DB_DEFAULT = "maintainpro_prod"
FG_PREFIX = "fg_"


def main() -> int:
    parser = argparse.ArgumentParser(description="FG-only mongorestore wrapper")
    parser.add_argument("--uri", required=True)
    parser.add_argument("--target-database", required=True)
    parser.add_argument(
        "--dump-dir",
        required=True,
        type=Path,
        help="Directory containing *.bson / *.metadata.json for one database dump",
    )
    parser.add_argument(
        "--production-database-name",
        default=PRODUCTION_DB_DEFAULT,
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.target_database == args.production_database_name:
        print(
            f"REFUSED WRITE: target database {args.target_database!r} is the company "
            f"production name. Restore only into an isolated database.",
            file=sys.stderr,
        )
        return 2

    if not args.dump_dir.is_dir():
        print(f"Dump directory not found: {args.dump_dir}", file=sys.stderr)
        return 1

    bson_files = sorted(args.dump_dir.glob("*.bson"))
    if not bson_files:
        print(f"No .bson files in {args.dump_dir}", file=sys.stderr)
        return 1

    refused: list[str] = []
    accepted: list[str] = []
    for path in bson_files:
        coll = path.stem
        if not coll.startswith(FG_PREFIX):
            refused.append(coll)
        else:
            accepted.append(coll)

    report = {
        "target_database": args.target_database,
        "accepted_fg_collections": accepted,
        "refused_non_fg_collections": refused,
    }
    print(json.dumps(report, indent=2))

    if refused:
        print(
            "REFUSED WRITE: dump contains non-fg_ collections: " + ", ".join(refused),
            file=sys.stderr,
        )
        return 2

    if args.dry_run:
        print("DRY_RUN: no mongorestore executed")
        return 0

    cmd = [
        "mongorestore",
        f"--uri={args.uri}",
        f"--nsFrom={args.dump_dir.name}.*",
        f"--nsTo={args.target_database}.*",
        "--dir",
        str(args.dump_dir),
    ]
    # Drop ns remap complexity: restore explicitly into target db via --db when dump is flat.
    # Prefer explicit --nsInclude for each fg collection when using directory-per-db layout.
    cmd = [
        "mongorestore",
        f"--uri={args.uri}",
        f"--db={args.target_database}",
        "--dir",
        str(args.dump_dir),
    ]
    for coll in accepted:
        cmd.extend(["--nsInclude", f"{args.dump_dir.name}.{coll}"])

    # Simpler portable approach: restore each collection file explicitly.
    failures = 0
    for coll in accepted:
        bson_path = args.dump_dir / f"{coll}.bson"
        meta_path = args.dump_dir / f"{coll}.metadata.json"
        one = [
            "mongorestore",
            f"--uri={args.uri}",
            f"--db={args.target_database}",
            f"--collection={coll}",
            str(bson_path),
        ]
        if meta_path.is_file():
            # metadata is auto-detected beside bson by mongorestore when using --dir;
            # for single-file restore, pass collection bson only.
            pass
        print("RUNNING:", " ".join(one[:4]), coll)
        completed = subprocess.run(one, check=False)
        if completed.returncode != 0:
            failures += 1

    if failures:
        print(f"RESTORE incomplete: {failures} collection failure(s)", file=sys.stderr)
        return 1

    print(f"OK: restored {len(accepted)} fg_* collections into {args.target_database!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
