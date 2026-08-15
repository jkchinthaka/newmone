"""Generate query-pattern compatibility inventory (static AST scan).

Usage:
  uv run python scripts/migration/generate_query_compatibility_inventory.py
"""

from __future__ import annotations

import argparse
import ast
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

PATTERNS = {
    "prefetch_related": "prefetch_related",
    "OuterRef": "OuterRef",
    "Subquery": "Subquery",
    "Exists": "Exists",
    "select_related": "select_related",
    "aggregate": "aggregate",
    "annotate": "annotate",
    "Lower": "Lower",
    "Upper": "Upper",
    "Coalesce": "Coalesce",
    "Case": "Case",
    "When": "When",
    "RawSQL": "RawSQL",
    "extra": "extra",
    "select_for_update": "select_for_update",
}

CORE_PATH_HINTS = {
    "Login": ["accounts", "login", "auth"],
    "Dashboard": ["dashboard", "workspace"],
    "Daily Records": ["recording", "scheduling"],
    "History": ["history", "recording"],
    "Recorder task": ["recording"],
    "Supervisor queue": ["reviews"],
    "QA queue": ["quality"],
    "Printing": ["print", "reports", "batch_dossier"],
    "RCA": ["rca"],
    "CAPA": ["capa"],
    "NCR": ["nonconformance"],
    "Reports": ["reports"],
}


def scan_file(path: Path) -> list[tuple[str, int, str]]:
    text = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return []
    hits: list[tuple[str, int, str]] = []
    for node in ast.walk(tree):
        name = None
        if isinstance(node, ast.Name) and node.id in PATTERNS:
            name = PATTERNS[node.id]
        elif isinstance(node, ast.Attribute) and node.attr in PATTERNS:
            name = PATTERNS[node.attr]
        if name:
            hits.append((name, getattr(node, "lineno", 0), path.as_posix()))
    return hits


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apps-root", default="apps")
    parser.add_argument(
        "--output",
        default="docs/migration/MONGO_QUERY_COMPATIBILITY_INVENTORY.md",
    )
    args = parser.parse_args()

    root = Path(args.apps_root)
    by_pattern: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for path in sorted(root.rglob("*.py")):
        rel = path.as_posix()
        if "/migrations/" in rel:
            continue
        for name, lineno, file_path in scan_file(path):
            by_pattern[name].append((lineno, file_path))

    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        "# Mongo Query Compatibility Inventory",
        "",
        f"**Generated (UTC):** {stamp}  ",
        "",
        "Static scan of unsupported / high-risk Django ORM patterns for MongoDB cutover.",
        "Counts are occurrence sites (AST), not unique business operations.",
        "",
        "## Pattern summary",
        "",
        "| Pattern | Occurrences | Mongo risk |",
        "| --- | ---: | --- |",
        (
            f"| prefetch_related | {len(by_pattern['prefetch_related'])} "
            "| HIGH — unsupported / rewrite |"
        ),
        f"| OuterRef | {len(by_pattern['OuterRef'])} | HIGH — unproven / rewrite |",
        f"| Subquery | {len(by_pattern['Subquery'])} | HIGH — unproven / rewrite |",
        f"| Exists | {len(by_pattern['Exists'])} | MEDIUM — verify |",
        (
            f"| select_for_update | {len(by_pattern['select_for_update'])} "
            "| BLOCKER — replace with CAS |"
        ),
        f"| annotate | {len(by_pattern['annotate'])} | MEDIUM — case-by-case |",
        f"| aggregate | {len(by_pattern['aggregate'])} | MEDIUM — case-by-case |",
        (
            "| Lower/Upper/Coalesce/Case/When | "
            + str(
                len(by_pattern["Lower"])
                + len(by_pattern["Upper"])
                + len(by_pattern["Coalesce"])
                + len(by_pattern["Case"])
                + len(by_pattern["When"])
            )
            + " | MEDIUM — expressions |"
        ),
        (
            f"| select_related | {len(by_pattern['select_related'])} "
            "| LOW-MEDIUM — often OK as joins/lookups |"
        ),
        (
            f"| RawSQL / extra | {len(by_pattern['RawSQL']) + len(by_pattern['extra'])} "
            "| HIGH if present |"
        ),
        "",
        "## Core operator path priority",
        "",
        "Prove these before optional modules:",
        "",
        "```text",
        "Login → Daily Record → Save → Submit → Supervisor → Return/Approve",
        "→ Correction/Resubmit → QA Release/Hold/Reject → History → Print",
        "Then: NCR → RCA → CAPA",
        "```",
        "",
        "| Core page | Related apps / hints |",
        "| --- | --- |",
    ]
    for page, hints in CORE_PATH_HINTS.items():
        lines.append(f"| {page} | {', '.join(hints)} |")

    lines.extend(["", "## Occurrences by pattern", ""])
    for pattern in sorted(by_pattern.keys()):
        items = by_pattern[pattern]
        lines.append(f"### `{pattern}` ({len(items)})")
        lines.append("")
        for lineno, file_path in sorted(items, key=lambda x: (x[1], x[0]))[:200]:
            rel = file_path
            if "/apps/" in rel:
                rel = "apps/" + rel.split("/apps/", 1)[1]
            lines.append(f"- `{rel}:{lineno}`")
        if len(items) > 200:
            lines.append(f"- … {len(items) - 200} more")
        lines.append("")

    lines.extend(
        [
            "## M2M / through / cascades",
            "",
            "See `docs/migration/FG_MONGODB_COLLECTION_MANIFEST.md` and "
            "`docs/migration/MONGODB_PRIMARY_KEY_PLAN.md` for through-model and PK review.",
            "Delete cascades and M2M must be validated per relationship on Mongo POC — "
            "do not assume PostgreSQL ON DELETE behavior.",
            "",
            "## Classification",
            "",
            "```text",
            "MONGODB SAME-DATABASE CUTOVER BLOCKED — CONTINUING COMPATIBILITY ENGINEERING",
            "```",
            "",
        ]
    )

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"WROTE={out}")
    for pattern in sorted(by_pattern.keys()):
        print(f"{pattern}={len(by_pattern[pattern])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
