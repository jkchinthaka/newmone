"""Generate MongoDB primary-key migration plan from Django models (static).

Usage:
  uv run python scripts/migration/generate_primary_key_plan.py
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

import django


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--settings", default="config.settings.test")
    parser.add_argument("--output", default="docs/migration/MONGODB_PRIMARY_KEY_PLAN.md")
    args = parser.parse_args()

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", args.settings)
    django.setup()

    from apps.core.db_namespace import (
        build_collection_specs,
        iter_fg_models,
        pk_classification,
        postgresql_table_for_model,
    )

    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    models_list = iter_fg_models(include_auto_created=True)
    classifications = [(m, pk_classification(m)) for m in models_list]
    counts = Counter(c for _, c in classifications)

    lines = [
        "# MongoDB Primary Key Plan",
        "",
        f"**Generated (UTC):** {stamp}  ",
        "**Production database:** `mgintginpro_prod`  ",
        "**Rule:** Do not silently regenerate IDs. Historical relationships must stay stable.",
        "",
        "## Classification summary",
        "",
        "| Classification | Count |",
        "| --- | ---: |",
    ]
    for key, count in sorted(counts.items(), key=lambda x: (-x[1], x[0])):
        lines.append(f"| {key} | {count} |")

    lines.extend(
        [
            "",
            "## Identity preservation requirements",
            "",
            "These domains must keep stable identity across PostgreSQL → Mongo cutover:",
            "",
            "- Checklist submissions and submission numbers",
            "- Supervisor / QA review decisions",
            "- Audit / security events",
            "- Quality cases, holds, quarantines",
            "- RCA / CAPA / NCR records and links",
            "",
            "UUID primary keys are the preferred SAFE CANDIDATE for FG domain models.",
            "Implicit BigAutoField / contrib AutoField models require explicit redesign",
            "before Mongo cutover — do not convert silently.",
            "",
            "## Per-model plan",
            "",
            "| App | Model | PG table | Mongo collection | PK | Classification | Cutover action |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
    )

    specs_by_key = {
        (s.app_label, s.model_name, s.is_auto_created): s for s in build_collection_specs()
    }

    for model, classification in classifications:
        key = (model._meta.app_label, model._meta.model_name, model._meta.auto_created)
        spec = specs_by_key[key]
        pk = model._meta.pk
        pk_desc = f"{pk.name}:{type(pk).__name__}" if pk else "?"
        if classification == "UUID — SAFE CANDIDATE":
            action = "Preserve UUID values as document `_id` or dedicated `id` field"
        elif classification == "OBJECTID-COMPATIBLE":
            action = "Already ObjectId-compatible — verify reference integrity"
        elif classification == "THROUGH MODEL — REVIEW":
            action = "Map M2M through documents; preserve both FKs"
        elif classification == "CONTRIB MODEL — REVIEW":
            action = (
                "Review Django contrib / Celery tables; "
                "may stay ObjectId on clean Mongo deploy"
            )
        elif "REQUIRES REDESIGN" in classification:
            action = "BLOCKER — introduce explicit UUID before cutover; no silent ID rewrite"
        else:
            action = "Owner review required"
        lines.append(
            f"| {spec.app_label} | {spec.model_class_name} | `{postgresql_table_for_model(model)}` "
            f"| `{spec.mongo_collection}` | `{pk_desc}` | {classification} | {action} |"
        )

    lines.extend(
        [
            "",
            "## Cutover policy",
            "",
            "1. Synthetic Mongo POC may use clean IDs for new data only.",
            "2. Production data migration (later) must map existing UUID PKs 1:1.",
            "3. Do not migrate PostgreSQL production data until Mongo runtime is proven.",
            (
                "4. Classification remains blocked while any REQUIRES REDESIGN "
                "PKs remain on the core path."
            ),
            "",
        ]
    )

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"WROTE={out}")
    for key, count in sorted(counts.items()):
        print(f"{key}={count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
