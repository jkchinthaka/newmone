#!/usr/bin/env python
"""Static collection collision audit: FG (fg_ namespace) vs MaintainPro Prisma models.

Does NOT connect to MongoDB. Safe to run without company credentials.

Usage:
  uv run python scripts/migration/collection_collision_audit.py \\
    --prisma-schema C:/path/to/maintainpro/prisma/schema.prisma

Writes: docs/migration/COLLECTION_COLLISION_AUDIT.md
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

import django

_PRISMA_MODEL_RE = re.compile(r"^model\s+(\w+)\s+\{", re.MULTILINE)


def _parse_prisma_models(schema_text: str) -> list[str]:
    return sorted(set(_PRISMA_MODEL_RE.findall(schema_text)))


def _prisma_collection_names(model_names: list[str]) -> set[str]:
    """Prisma MongoDB default collection names match model names (PascalCase)."""
    return set(model_names)


def main() -> int:
    parser = argparse.ArgumentParser(description="FG vs MaintainPro collection collision audit")
    parser.add_argument(
        "--prisma-schema",
        type=Path,
        default=Path(r"C:\Users\chint\source\newmone\maintainpro\prisma\schema.prisma"),
        help="Path to MaintainPro prisma/schema.prisma",
    )
    parser.add_argument(
        "--settings",
        default="config.settings.test",
        help="Django settings for FG model inventory",
    )
    parser.add_argument(
        "--production-database",
        default="mgintginpro_prod",
        help="Documented company logical database name (no connection)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("docs/migration/COLLECTION_COLLISION_AUDIT.md"),
    )
    args = parser.parse_args()

    if not args.prisma_schema.is_file():
        print(f"ERROR: Prisma schema not found: {args.prisma_schema}", file=sys.stderr)
        return 2

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", args.settings)
    os.environ["FG_COLLECTION_NAMESPACE_ENABLED"] = "1"
    os.environ["FG_COLLECTION_PREFIX"] = "fg_"
    django.setup()

    from apps.core.db_namespace import apply_fg_collection_namespace, planned_fg_collections

    apply_fg_collection_namespace()
    fg_rows = planned_fg_collections(prefix="fg_")
    fg_names = {row[2] for row in fg_rows}

    mp_models = _parse_prisma_models(args.prisma_schema.read_text(encoding="utf-8"))
    mp_collections = _prisma_collection_names(mp_models)

    exact_collisions = sorted(fg_names & mp_collections)
    # Case-insensitive overlap (FG uses snake_case; MP uses PascalCase — still check)
    mp_lower = {c.lower(): c for c in mp_collections}
    case_insensitive = sorted(
        name for name in fg_names if name.lower() in mp_lower and name not in mp_collections
    )

    # Semantic warnings: FG collection stem matches MP model name loosely
    semantic_warnings: list[str] = []
    for fg in fg_rows:
        _app, _model, coll = fg
        stem = coll.removeprefix("fg_")
        for mp in mp_models:
            if stem.replace("_", "").lower() == mp.lower():
                semantic_warnings.append(f"{coll} ~ {mp} (normalized stem match)")

    status = "SAFE — NO COLLISION" if not exact_collisions else "COLLISION — CUTOVER BLOCKED"
    if case_insensitive and status.startswith("SAFE"):
        status = "UNKNOWN — MANUAL REVIEW REQUIRED"

    out = args.output
    out.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    lines = [
        "# Collection Collision Audit — FG vs MaintainPro",
        "",
        f"**Generated (UTC):** {stamp}  ",
        f"**Production logical database (documented):** `{args.production_database}`  ",
        "**MongoDB connection:** None (static analysis only)  ",
        f"**Prisma schema source:** `{args.prisma_schema}`  ",
        "",
        "## Summary",
        "",
        "| Field | Value |",
        "| --- | --- |",
        f"| EXISTING_DATABASE_NAME | `{args.production_database}` |",
        f"| EXISTING_COLLECTION_COUNT (MaintainPro Prisma models) | {len(mp_collections)} |",
        f"| PLANNED_FG_COLLECTION_COUNT (fg_ namespace) | {len(fg_names)} |",
        f"| EXACT_NAME_COLLISIONS | {len(exact_collisions)} |",
        f"| CLASSIFICATION | **{status}** |",
        "",
        "## Rules",
        "",
        "- MaintainPro owns existing PascalCase Prisma collections — **do not touch**.",
        "- FG owns only `fg_*` collections in the same logical database.",
        "- No development/POC writes to `mgintginpro_prod` until full gate passage.",
        "",
    ]

    if exact_collisions:
        lines.extend(["## COLLISION — exact name matches", ""])
        for name in exact_collisions:
            lines.append(f"- `{name}`")
        lines.append("")

    if case_insensitive:
        lines.extend(["## UNKNOWN — case-insensitive overlaps", ""])
        for name in case_insensitive:
            lines.append(f"- `{name}`")
        lines.append("")

    if semantic_warnings:
        lines.extend(["## Manual review — normalized stem similarities", ""])
        for w in sorted(set(semantic_warnings))[:40]:
            lines.append(f"- {w}")
        if len(set(semantic_warnings)) > 40:
            lines.append(f"- ... and {len(set(semantic_warnings)) - 40} more")
        lines.append("")

    lines.extend(
        [
            "## MaintainPro collections (reference sample)",
            "",
            "First 20 Prisma model / collection names:",
            "",
        ]
    )
    for name in mp_models[:20]:
        lines.append(f"- `{name}`")
    lines.append(f"- ... ({len(mp_models) - 20} more)" if len(mp_models) > 20 else "")

    lines.extend(["", "## Planned FG collections (sample)", ""])
    for _app, _model, coll in fg_rows[:25]:
        lines.append(f"- `{coll}`")
    if len(fg_rows) > 25:
        lines.append(f"- ... ({len(fg_rows) - 25} more)")

    lines.extend(
        [
            "",
            "## Pre-cutover live inventory (required before company write)",
            "",
            "Run read-only on authorized staging/production host:",
            "",
            "```javascript",
            f"use {args.production_database}",
            "db.getCollectionNames().sort()",
            "```",
            "",
            "Compare output to this static audit. Any unexpected overlap → **CUTOVER BLOCKED**.",
            "",
        ]
    )

    out.write_text("\n".join(line for line in lines if line is not None) + "\n", encoding="utf-8")
    print(f"CLASSIFICATION={status}")
    print(f"MP_COLLECTIONS={len(mp_collections)}")
    print(f"FG_COLLECTIONS={len(fg_names)}")
    print(f"EXACT_COLLISIONS={len(exact_collisions)}")
    print(f"WROTE={out}")
    return 1 if exact_collisions else 0


if __name__ == "__main__":
    sys.exit(main())
