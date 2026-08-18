#!/usr/bin/env python3
"""Copy vendored frontend assets from node_modules into static/dist (no CDN)."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def must_copy(src: Path, dest: Path) -> None:
    if not src.exists():
        print(f"Missing vendor asset: {src}", file=sys.stderr)
        raise SystemExit(1)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    print(f"Copied {src.relative_to(ROOT)} -> {dest.relative_to(ROOT)}")


def main() -> int:
    must_copy(
        ROOT / "node_modules" / "htmx.org" / "dist" / "htmx.min.js",
        ROOT / "static" / "dist" / "js" / "htmx.min.js",
    )
    must_copy(
        ROOT / "static" / "src" / "js" / "app.js",
        ROOT / "static" / "dist" / "js" / "app.js",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
