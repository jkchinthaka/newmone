"""Generate exact full MongoDB compatibility inventory (AST + path scans).

Usage:
  uv run python scripts/migration/generate_full_compatibility_inventory.py
"""

from __future__ import annotations

import argparse
import ast
import re
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

SEARCH_ROOTS = ("apps", "config", "scripts", "tests")
SKIP_DIRS = {".venv", "node_modules", "__pycache__", ".git", "staticfiles", "htmlcov"}

# Patterns that indicate PostgreSQL / ORM lock / query risk
TOKEN_PATTERNS: list[tuple[str, str, str]] = [
    ("select_for_update", "LOCKING", "Replace with CAS / unique / atomic conditional update"),
    ("prefetch_related", "QUERY", "Rewrite without prefetch_related"),
    ("OuterRef", "QUERY", "Rewrite selector without OuterRef"),
    ("Subquery", "QUERY", "Rewrite selector without Subquery"),
    ("Exists", "QUERY", "Verify Exists support or rewrite"),
    ("transaction.atomic", "TRANSACTION", "Use persistence.atomic facade; flatten nesting"),
    ("transaction.on_commit", "TRANSACTION", "Use persistence.on_commit"),
    ("IntegrityError", "CONCURRENCY", "Normalize unique conflicts via persistence helpers"),
    ("RunSQL", "MIGRATION", "PostgreSQL-specific SQL — redesign for Mongo"),
    ("ArrayField", "SCHEMA", "Not portable — redesign field"),
    ("StringAgg", "QUERY", "Unsupported aggregation — rewrite"),
    ("django.db.backends.postgresql", "SETTINGS", "Mongo engine required for cutover"),
    ("psycopg", "DRIVER", "PostgreSQL driver reference — review for Mongo mode"),
    ("pg_dump", "OPS", "Replace with FG-only Mongo backup tooling"),
    ("pg_restore", "OPS", "Replace with FG-only Mongo restore tooling"),
    ("dumpdata", "OPS", "Do not rely on dumpdata/loaddata for Mongo"),
    ("loaddata", "OPS", "Do not rely on dumpdata/loaddata for Mongo"),
    ("select_for_update(", "LOCKING", "Replace with CAS / unique / atomic conditional update"),
]

ATTR_CALLS = {
    "select_for_update",
    "prefetch_related",
    "select_related",
    "bulk_create",
    "bulk_update",
    "update_or_create",
    "get_or_create",
    "extra",
    "raw",
    "aggregate",
    "annotate",
}

NAME_TOKENS = {
    "OuterRef",
    "Subquery",
    "Exists",
    "F",
    "Q",
    "Max",
    "Min",
    "Avg",
    "Sum",
    "Count",
    "Trunc",
    "StringAgg",
    "Lower",
    "Upper",
    "Coalesce",
    "Case",
    "When",
    "IntegrityError",
    "UniqueConstraint",
    "CheckConstraint",
    "BigAutoField",
    "AutoField",
    "JSONField",
    "ArrayField",
    "RunSQL",
    "RunPython",
}


def _iter_py_files(roots: list[Path]) -> list[Path]:
    files: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*.py"):
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            files.append(path)
    return sorted(files)


def _enclosing(tree: ast.AST, lineno: int) -> str:
    best = "<module>"
    best_span = 10**9
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            end = getattr(node, "end_lineno", node.lineno)
            if node.lineno <= lineno <= end:
                span = end - node.lineno
                if span < best_span:
                    best_span = span
                    best = node.name
    return best


def _scan_ast(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return []
    hits: list[dict[str, str]] = []
    rel = path.as_posix()

    for node in ast.walk(tree):
        kind = None
        token = None
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr in ATTR_CALLS:
                kind = "CALL"
                token = node.func.attr
        elif isinstance(node, ast.Name) and node.id in NAME_TOKENS:
            kind = "NAME"
            token = node.id
        elif isinstance(node, ast.Attribute) and node.attr in {"atomic", "on_commit"}:
            # transaction.atomic / transaction.on_commit
            if isinstance(node.value, ast.Name) and node.value.id == "transaction":
                kind = "ATTR"
                token = f"transaction.{node.attr}"
        if not token:
            continue
        lineno = getattr(node, "lineno", 0)
        hits.append(
            {
                "file": rel,
                "line": str(lineno),
                "function": _enclosing(tree, lineno),
                "token": token,
                "kind": kind or "?",
            }
        )
    return hits


def _risk_for(token: str) -> tuple[str, str]:
    high_lock = {"select_for_update"}
    high_query = {"prefetch_related", "OuterRef", "Subquery", "StringAgg", "ArrayField", "RunSQL"}
    if token in high_lock:
        return "HIGH", "Row lock unsupported on Mongo — redesign concurrency"
    if token in high_query:
        return "HIGH", "Unsupported / unproven query or schema feature"
    if token.startswith("transaction."):
        return "MEDIUM", "Verify Mongo transaction API / nesting"
    if token in {"IntegrityError", "get_or_create", "update_or_create"}:
        return "MEDIUM", "Race / uniqueness semantics must be proven"
    return "LOW-MEDIUM", "Review for Mongo semantics"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        default="docs/migration/MONGO_FULL_COMPATIBILITY_INVENTORY.md",
    )
    args = parser.parse_args()

    roots = [Path(r) for r in SEARCH_ROOTS]
    files = _iter_py_files(roots)
    findings: list[dict[str, str]] = []
    for path in files:
        findings.extend(_scan_ast(path))

    # Also catch string-level ops scripts (pg_dump etc.)
    text_hits: list[dict[str, str]] = []
    ops_re = re.compile(r"\b(pg_dump|pg_restore|psql|POSTGRES_|dumpdata|loaddata)\b")
    for path in files:
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            m = ops_re.search(line)
            if m:
                text_hits.append(
                    {
                        "file": path.as_posix(),
                        "line": str(i),
                        "function": "<text>",
                        "token": m.group(1),
                        "kind": "TEXT",
                    }
                )

    all_hits = findings + text_hits
    by_token: dict[str, list[dict[str, str]]] = defaultdict(list)
    for hit in all_hits:
        by_token[hit["token"]].append(hit)

    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        "# Mongo Full Compatibility Inventory",
        "",
        f"**Generated (UTC):** {stamp}  ",
        f"**Files scanned:** {len(files)}  ",
        f"**Findings:** {len(all_hits)}  ",
        "",
        "Exact machine-generated inventory. Do not treat approximate historical counts as current.",
        "",
        "## Token summary",
        "",
        "| Token | Count | Risk band |",
        "| --- | ---: | --- |",
    ]
    for token, items in sorted(by_token.items(), key=lambda x: (-len(x[1]), x[0])):
        risk, _ = _risk_for(token)
        lines.append(f"| `{token}` | {len(items)} | {risk} |")

    lines.extend(
        [
            "",
            "## Findings",
            "",
        ]
    )

    counter = 0
    for token, items in sorted(by_token.items(), key=lambda x: x[0].lower()):
        risk, redesign = _risk_for(token)
        for item in sorted(items, key=lambda h: (h["file"], int(h["line"]))):
            counter += 1
            fid = f"MC-{counter:04d}"
            rel = item["file"]
            if "/apps/" in rel:
                rel = "apps/" + rel.split("/apps/", 1)[1]
            elif "/config/" in rel:
                rel = "config/" + rel.split("/config/", 1)[1]
            elif "/scripts/" in rel:
                rel = "scripts/" + rel.split("/scripts/", 1)[1]
            elif "/tests/" in rel:
                rel = "tests/" + rel.split("/tests/", 1)[1]
            lines.extend(
                [
                    f"### {fid}",
                    "",
                    f"- **ID:** {fid}",
                    f"- **File:** `{rel}:{item['line']}`",
                    f"- **Function/Class:** `{item['function']}`",
                    f"- **Token:** `{token}` ({item['kind']})",
                    "- **Current PostgreSQL behavior:** uses Django ORM/SQL feature above",
                    f"- **Mongo compatibility:** {risk}",
                    "- **Business invariant:** preserve existing domain semantics; do not weaken",
                    f"- **Risk:** {risk}",
                    f"- **Required redesign:** {redesign}",
                    "- **Test required:** yes — Mongo + regression on PostgreSQL during migration",
                    "- **Status:** OPEN",
                    "",
                ]
            )

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"WROTE={out}")
    print(f"FINDINGS={len(all_hits)}")
    for token, items in sorted(by_token.items(), key=lambda x: (-len(x[1]), x[0]))[:20]:
        print(f"{token}={len(items)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
