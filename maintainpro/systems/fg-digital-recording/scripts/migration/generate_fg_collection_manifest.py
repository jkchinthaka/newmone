"""Generate FG MongoDB collection manifest (static — no Mongo writes).

Usage:
  uv run python scripts/migration/generate_fg_collection_manifest.py
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

import django


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--settings", default="config.settings.test")
    parser.add_argument(
        "--output",
        default="docs/migration/FG_MONGODB_COLLECTION_MANIFEST.md",
    )
    parser.add_argument("--prefix", default="fg_")
    args = parser.parse_args()

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", args.settings)
    django.setup()

    from django.apps import apps

    from apps.core.db_namespace import (
        build_collection_specs,
        collision_note,
        index_summary,
        pk_classification,
        planned_collection_for_model,
        relationship_summary,
    )

    # Optional MaintainPro names from sibling repo if present
    mp_names: set[str] = set()
    prisma = Path(r"C:\Users\chint\source\newmone\maintainpro\prisma\schema.prisma")
    if prisma.is_file():
        for line in prisma.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("model "):
                mp_names.add(line.split()[1])

    specs = build_collection_specs(prefix=args.prefix)
    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines: list[str] = [
        "# FG MongoDB Collection Manifest",
        "",
        f"**Generated (UTC):** {stamp}  ",
        f"**Production logical database:** `maintainpro_prod`  ",
        f"**Namespace prefix:** `{args.prefix}`  ",
        f"**Collection count:** {len(specs)}  ",
        "",
        "## Naming contract",
        "",
        "```text",
        f"{args.prefix}{{django_default_db_table}}",
        "```",
        "",
        "FG collections live in the **same** logical database as MaintainPro.",
        "Do **not** create a separate FG production database.",
        "Do **not** reuse or rename MaintainPro collections.",
        "",
        "## Summary",
        "",
        "| Field | Value |",
        "| --- | --- |",
        "| EXISTING_DATABASE_NAME | `maintainpro_prod` |",
        f"| PLANNED_FG_COLLECTION_COUNT | {len(specs)} |",
        f"| MAINTAINPRO_PRISMA_MODELS (reference) | {len(mp_names) or 'n/a'} |",
        "| EXACT_COLLISIONS | "
        + str(sum(1 for s in specs if collision_note(s.mongo_collection, mp_names) != "NONE"))
        + " |",
        "",
        "## Collections",
        "",
    ]

    for spec in specs:
        model = None
        for candidate in apps.get_models(include_auto_created=True):
            if (
                candidate._meta.app_label == spec.app_label
                and candidate._meta.model_name == spec.model_name
                and candidate._meta.auto_created == spec.is_auto_created
            ):
                model = candidate
                break
        assert model is not None
        pk_class = pk_classification(model)
        indexes = index_summary(model)
        rels = relationship_summary(model)
        collision = collision_note(spec.mongo_collection, mp_names)
        concern = "auto-created through / M2M" if spec.is_auto_created else "standard model"
        if "REQUIRES REDESIGN" in pk_class or "REVIEW" in pk_class:
            concern = f"{concern}; PK: {pk_class}"

        lines.extend(
            [
                f"### `{spec.mongo_collection}`",
                "",
                f"- **Django model:** `{spec.app_label}.{spec.model_class_name}`",
                f"- **Existing PostgreSQL table:** `{spec.postgresql_table}`",
                f"- **Proposed Mongo collection:** `{spec.mongo_collection}`",
                f"- **PK field / type:** `{spec.pk_field}` / `{spec.pk_type}`",
                f"- **PK classification:** {pk_class}",
                f"- **Indexes / uniques:** "
                f"{('; '.join(indexes) if indexes else '(none beyond defaults)')}",
                f"- **Relationships:** {('; '.join(rels) if rels else '(none)')}",
                f"- **Migration concern:** {concern}",
                f"- **MaintainPro collision:** {collision}",
                f"- **Auto-created:** {spec.is_auto_created}",
                "",
            ]
        )

    # Ensure planned_collection_for_model is exercised for consistency check
    _ = [planned_collection_for_model(m, prefix=args.prefix) for m in apps.get_models()]

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"WROTE={out}")
    print(f"COUNT={len(specs)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
