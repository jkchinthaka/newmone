#!/usr/bin/env python3
"""Generate deterministic CSS custom properties from design tokens JSON."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
TOKEN_SOURCE = ROOT / "design" / "tokens" / "nelna-fg.tokens.json"
OUTPUT_CSS = ROOT / "static" / "src" / "css" / "generated-tokens.css"
DESIGN_OUTPUT_CSS = ROOT / "design" / "generated" / "nelna-fg.tokens.css"

REQUIRED_GROUPS = ("color", "typography", "spacing", "radius")
REFERENCE_RE = re.compile(r"^\{([a-zA-Z0-9._-]+)\}$")

HEADER = """\
/*
 * GENERATED FILE — do not edit by hand.
 * Source: design/tokens/nelna-fg.tokens.json
 * Generator: scripts/build_design_tokens.py
 * Authoritative generated CSS for the app build: static/src/css/generated-tokens.css
 * Mirror copy: design/generated/nelna-fg.tokens.css
 */
"""


class TokenError(ValueError):
    """Raised when token JSON is invalid or incomplete."""


def load_tokens(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise TokenError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise TokenError("Token root must be an object")
    return data


def validate_required_groups(data: dict[str, Any]) -> None:
    missing = [name for name in REQUIRED_GROUPS if name not in data]
    if missing:
        raise TokenError(f"Missing required token groups: {', '.join(missing)}")


def walk_leaves(node: Any, prefix: tuple[str, ...] = ()) -> list[tuple[str, dict[str, Any]]]:
    leaves: list[tuple[str, dict[str, Any]]] = []
    if isinstance(node, dict):
        if "value" in node and "type" in node:
            leaves.append((".".join(prefix), node))
            return leaves
        for key, child in node.items():
            if key.startswith("$"):
                continue
            leaves.extend(walk_leaves(child, (*prefix, key)))
    return leaves


def resolve_path(data: dict[str, Any], dotted: str) -> Any:
    current: Any = data
    for part in dotted.split("."):
        if not isinstance(current, dict) or part not in current:
            raise TokenError(f"Unresolved token reference: {{{dotted}}}")
        current = current[part]
    return current


def resolve_value(data: dict[str, Any], value: Any, stack: tuple[str, ...] = ()) -> Any:
    if not isinstance(value, str):
        return value
    match = REFERENCE_RE.fullmatch(value.strip())
    if not match:
        return value
    ref = match.group(1)
    if ref in stack:
        raise TokenError(f"Circular token reference involving {ref}")
    target = resolve_path(data, ref)
    if isinstance(target, dict) and "value" in target:
        return resolve_value(data, target["value"], (*stack, ref))
    raise TokenError(f"Token reference {{{ref}}} does not point to a value leaf")


def validate_leaf(path: str, leaf: dict[str, Any]) -> None:
    token_type = leaf.get("type")
    value = leaf.get("value")
    if not isinstance(token_type, str) or not token_type:
        raise TokenError(f"Token {path} missing type")
    if value is None or value == "":
        raise TokenError(f"Token {path} missing value")
    if token_type == "color" and isinstance(value, str):  # nosec B105
        if not (
            value.startswith("#")
            or value.startswith("rgb")
            or value.startswith("hsl")
            or REFERENCE_RE.fullmatch(value.strip())
        ):
            raise TokenError(f"Token {path} has invalid color value type")
    if token_type in {"spacing", "dimension", "borderRadius", "fontSizes", "lineHeights"} and not (
        isinstance(value, (int, float, str))
    ):
        raise TokenError(f"Token {path} has invalid numeric/string value")


def css_var_name(path: str) -> str:
    # Map a few semantic paths to stable foundation aliases used by app.css
    aliases = {
        "color.semantic.border.focus": "--color-focus-ring",
        "color.semantic.border.default": "--color-border-default",
        "color.semantic.action.primary": "--color-brand-primary",
        "color.semantic.surface.app-background": "--color-surface-app",
        "color.semantic.surface.card": "--color-surface-default",
        "color.semantic.text.primary": "--color-text-primary",
        "color.semantic.text.secondary": "--color-text-secondary",
        "color.semantic.status.critical": "--color-status-danger",
        "color.semantic.status.success": "--color-status-success",
        "color.semantic.status.warning": "--color-status-warning",
    }
    if path in aliases:
        return aliases[path]
    normalized = path.replace(".", "-").replace("_", "-")
    return f"--token-{normalized}"


def build_css(data: dict[str, Any]) -> str:
    validate_required_groups(data)
    leaves = walk_leaves({k: v for k, v in data.items() if not k.startswith("$")})
    if not leaves:
        raise TokenError("No token leaves found")

    lines: list[str] = [HEADER, ":root {"]
    entries: list[tuple[str, str]] = []
    for path, leaf in leaves:
        validate_leaf(path, leaf)
        resolved = resolve_value(data, leaf["value"])
        if isinstance(resolved, bool):
            raise TokenError(f"Token {path} resolved to unsupported boolean")
        css_value = str(resolved)
        entries.append((css_var_name(path), css_value))
        # Always emit the full path-based variable for completeness
        full_name = f"--token-{path.replace('.', '-').replace('_', '-')}"
        if full_name != css_var_name(path):
            entries.append((full_name, css_value))

    # Stable focus ring fallback from primary if no dedicated focus token
    if "--color-focus-ring" not in {name for name, _ in entries}:
        primary = next((v for n, v in entries if n == "--color-brand-primary"), None)
        if primary:
            entries.append(("--color-focus-ring", primary))
        else:
            raise TokenError("Missing brand primary color for focus ring")

    # Border default fallback from primitive gray if semantic border absent
    if "--color-border-default" not in {name for name, _ in entries}:
        gray = next(
            (v for n, v in entries if n == "--token-color-primitive-gray-300"),
            None,
        )
        if gray:
            entries.append(("--color-border-default", gray))

    for name, value in sorted(set(entries)):
        lines.append(f"  {name}: {value};")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def write_outputs(css: str) -> None:
    OUTPUT_CSS.parent.mkdir(parents=True, exist_ok=True)
    DESIGN_OUTPUT_CSS.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_CSS.write_text(css, encoding="utf-8", newline="\n")
    DESIGN_OUTPUT_CSS.write_text(css, encoding="utf-8", newline="\n")


def check_outputs(css: str) -> None:
    for path in (OUTPUT_CSS, DESIGN_OUTPUT_CSS):
        if not path.exists():
            raise TokenError(f"Generated file missing: {path}")
        existing = path.read_text(encoding="utf-8")
        if existing != css:
            raise TokenError(f"Generated file out of date: {path}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate tokens and fail if generated CSS is out of date",
    )
    args = parser.parse_args(argv)
    try:
        data = load_tokens(TOKEN_SOURCE)
        css = build_css(data)
        if args.check:
            check_outputs(css)
            print("Design tokens OK — generated CSS is current.")
        else:
            write_outputs(css)
            print(f"Wrote {OUTPUT_CSS.relative_to(ROOT)}")
            print(f"Wrote {DESIGN_OUTPUT_CSS.relative_to(ROOT)}")
    except TokenError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
