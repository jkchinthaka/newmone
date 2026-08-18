"""Generate exact select_for_update inventory for Mongo concurrency redesign.

Usage:
  uv run python scripts/migration/generate_concurrency_inventory.py
"""

from __future__ import annotations

import argparse
import ast
import re
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

DOMAIN_MAP = {
    "recording": "recording",
    "correction": "correction",
    "reviews": "reviews",
    "quality": "quality",
    "rca": "RCA",
    "capa": "CAPA",
    "nonconformance": "NCR",
    "scheduling": "scheduling",
    "checklists": "checklists",
    "laboratory": "laboratory",
    "haccp": "HACCP",
    "quality_quarantine": "inventory-related quality modules",
    "rework": "inventory-related quality modules",
    "dispatch": "inventory-related quality modules",
    "batch_genealogy": "inventory-related quality modules",
    "batch_dossier": "inventory-related quality modules",
    "sampling": "inventory-related quality modules",
    "foreign_body": "other",
    "sanitation": "other",
    "environmental": "other",
    "instruments": "other",
    "master_data": "other",
    "organizations": "other",
    "accounts": "other",
    "access_control": "other",
    "training": "other",
    "notifications": "other",
    "evidence": "other",
    "document_control": "other",
    "integrations": "other",
    "reports": "other",
    "customer_complaints": "other",
    "supplier_quality": "other",
}


def domain_for(path: Path) -> str:
    parts = path.parts
    try:
        idx = parts.index("apps")
        app = parts[idx + 1]
    except (ValueError, IndexError):
        return "other"
    if "correction" in path.name:
        return "correction"
    return DOMAIN_MAP.get(app, "other")


def enclosing_function(node: ast.AST, lineno: int) -> str:
    for parent in ast.walk(node):
        if isinstance(parent, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if parent.lineno <= lineno <= getattr(parent, "end_lineno", parent.lineno):
                # Prefer innermost
                pass
    # Re-scan for innermost
    best = "<module>"
    best_span = 10**9
    for parent in ast.walk(node):
        if isinstance(parent, (ast.FunctionDef, ast.AsyncFunctionDef)):
            end = getattr(parent, "end_lineno", parent.lineno)
            if parent.lineno <= lineno <= end:
                span = end - parent.lineno
                if span < best_span:
                    best_span = span
                    best = parent.name
    return best


def locked_model_guess(source_line: str, prev_lines: list[str]) -> str:
    window = "\n".join(prev_lines[-8:] + [source_line])
    # Model.objects...select_for_update
    pattern = (
        r"([A-Z][A-Za-z0-9_]*)\.objects(?:\s*\n\s*)?(?:\.\w+\([^)]*\)\s*)*"
        r"\.select_for_update"
    )
    m = re.search(pattern, window)
    if m:
        return m.group(1)
    m = re.search(r"([A-Z][A-Za-z0-9_]*)\.objects\.select_for_update", source_line)
    if m:
        return m.group(1)
    # chained from variable
    m = re.search(r"(\w+)\s*=\s*([A-Z][A-Za-z0-9_]*)\.objects", window)
    if m:
        return m.group(2)
    return "UNKNOWN"


def propose_replacement(domain: str, locked_model: str) -> str:
    return (
        "Optimistic conditional transition (compare-and-set) via "
        "`apps.core.optimistic_transition` — unique constraint + "
        "filter(status/version/decision) update; retry on conflict. "
        f"Domain={domain}; locked={locked_model}."
    )


def scan_file(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return []
    lines = text.splitlines()
    hits: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = None
        if isinstance(func, ast.Attribute) and func.attr == "select_for_update":
            name = "select_for_update"
        if name is None:
            continue
        lineno = node.lineno
        fn = enclosing_function(tree, lineno)
        prev = lines[max(0, lineno - 9) : lineno]
        locked = locked_model_guess(lines[lineno - 1], prev)
        domain = domain_for(path)
        hits.append(
            {
                "file": str(path).replace("\\", "/"),
                "line": lineno,
                "function": fn,
                "locked_model": locked,
                "domain": domain,
                "source": lines[lineno - 1].strip(),
            }
        )
    return hits


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apps-root", default="apps")
    parser.add_argument("--output", default="docs/migration/MONGO_CONCURRENCY_INVENTORY.md")
    args = parser.parse_args()

    root = Path(args.apps_root)
    sites: list[dict] = []
    for path in sorted(root.rglob("*.py")):
        if "/migrations/" in str(path).replace("\\", "/"):
            continue
        sites.extend(scan_file(path))

    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    by_domain: dict[str, list[dict]] = defaultdict(list)
    for site in sites:
        by_domain[site["domain"]].append(site)

    lines = [
        "# Mongo Concurrency Inventory (`select_for_update`)",
        "",
        f"**Generated (UTC):** {stamp}  ",
        f"**Exact call-site count:** {len(sites)}  ",
        "",
        "PostgreSQL row locks are **not** supported by django-mongodb-backend.",
        "Do not delete these call sites without a proven Mongo-safe replacement.",
        "",
        "## Domain summary",
        "",
        "| Domain | Count |",
        "| --- | ---: |",
    ]
    for domain, items in sorted(by_domain.items(), key=lambda x: (-len(x[1]), x[0])):
        lines.append(f"| {domain} | {len(items)} |")

    lines.extend(
        [
            "",
            "## Replacement policy",
            "",
            "Approved pattern: **optimistic conditional transition** "
            "(atomic compare-and-set / conditional update + unique indexes + retry).",
            "See `apps/core/optimistic_transition.py` and "
            "`docs/migration/MONGO_CONCURRENCY_PATTERN.md`.",
            "",
            "Do **not** rewrite all sites blindly. Spike order:",
            "1. Supervisor review",
            "2. QA review",
            "3. Recording / submission / correction",
            "4. RCA",
            "",
        ]
    )

    for domain, items in sorted(by_domain.items(), key=lambda x: x[0].lower()):
        lines.append(f"## Domain: {domain}")
        lines.append("")
        for site in sorted(items, key=lambda s: (s["file"], s["line"])):
            rel = site["file"]
            if "/apps/" in rel:
                rel = "apps/" + rel.split("/apps/", 1)[1]
            lines.extend(
                [
                    f"### `{rel}:{site['line']}` — `{site['function']}`",
                    "",
                    f"- **File:** `{rel}`",
                    f"- **Function:** `{site['function']}`",
                    f"- **Locked model (heuristic):** `{site['locked_model']}`",
                    "- **Invariant protected:** serialize competing writes on this row/aggregate "
                    "(exact invariant requires service-level review)",
                    "- **Competing operation:** concurrent service calls touching the same entity",
                    "- **Failure if race occurs:** duplicate decisions, lost updates, "
                    "invalid state transitions, or broken idempotency",
                    (
                        "- **Proposed Mongo replacement:** "
                        f"{propose_replacement(domain, site['locked_model'])}"
                    ),
                    f"- **Source:** `{site['source']}`",
                    "",
                ]
            )

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"WROTE={out}")
    print(f"SELECT_FOR_UPDATE_COUNT={len(sites)}")
    print(dict(Counter(s["domain"] for s in sites)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
