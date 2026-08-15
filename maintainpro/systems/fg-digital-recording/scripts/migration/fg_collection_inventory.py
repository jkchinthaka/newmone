#!/usr/bin/env python
"""List planned FG MongoDB collection names for same-database collision audits.

Usage (isolated — does not connect to MongoDB):
  uv run python scripts/migration/fg_collection_inventory.py

With optional prefix proposal:
  uv run python scripts/migration/fg_collection_inventory.py --prefix fg_

Compare output against a MaintainPro listCollections export before any cutover.
"""

from __future__ import annotations

import argparse
import os
import sys

import django


def main() -> int:
    parser = argparse.ArgumentParser(description="FG planned collection inventory")
    parser.add_argument(
        "--prefix",
        default="",
        help="Optional prefix to propose for db_table (e.g. fg_)",
    )
    parser.add_argument(
        "--settings",
        default="config.settings.test",
        help="Django settings module",
    )
    args = parser.parse_args()

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", args.settings)
    django.setup()

    from django.apps import apps

    rows: list[tuple[str, str, str]] = []
    for model in apps.get_models():
        if model._meta.proxy or model._meta.app_label == "mongo_poc":
            continue
        default_table = model._meta.db_table
        proposed = f"{args.prefix}{default_table}" if args.prefix else default_table
        rows.append((model._meta.app_label, model.__name__, proposed))

    rows.sort(key=lambda r: r[2])
    print(f"FG_PLANNED_COLLECTION_COUNT={len(rows)}")
    if args.prefix:
        print(f"PROPOSED_PREFIX={args.prefix!r}")
    print("app_label,model,planned_collection")
    for app_label, name, table in rows:
        print(f"{app_label},{name},{table}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
