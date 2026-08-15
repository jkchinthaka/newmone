"""Design token generation tests."""

from __future__ import annotations

import copy
from pathlib import Path

import pytest
from scripts.build_design_tokens import (
    OUTPUT_CSS,
    TOKEN_SOURCE,
    TokenError,
    build_css,
    load_tokens,
    main,
)

ROOT = Path(__file__).resolve().parents[2]


def test_token_json_parses() -> None:
    data = load_tokens(TOKEN_SOURCE)
    assert "color" in data


def test_required_groups_exist() -> None:
    data = load_tokens(TOKEN_SOURCE)
    css = build_css(data)
    assert ":root" in css
    assert "--color-brand-primary" in css


def test_invalid_tokens_fail() -> None:
    data = load_tokens(TOKEN_SOURCE)
    broken = copy.deepcopy(data)
    broken["color"]["primitive"]["green"]["700"]["value"] = None
    with pytest.raises(TokenError):
        build_css(broken)


def test_missing_required_tokens_fail() -> None:
    data = load_tokens(TOKEN_SOURCE)
    broken = copy.deepcopy(data)
    del broken["spacing"]
    with pytest.raises(TokenError):
        build_css(broken)


def test_generation_is_deterministic() -> None:
    data = load_tokens(TOKEN_SOURCE)
    assert build_css(data) == build_css(data)


def test_generated_css_is_current() -> None:
    assert main(["--check"]) == 0
    assert OUTPUT_CSS.exists()


def test_templates_do_not_use_cdn() -> None:
    templates = (ROOT / "templates").rglob("*.html")
    for path in templates:
        text = path.read_text(encoding="utf-8")
        assert "cdn.jsdelivr" not in text
        assert "unpkg.com" not in text
        assert "cdnjs.cloudflare" not in text


def test_htmx_asset_is_local() -> None:
    asset = ROOT / "static" / "dist" / "js" / "htmx.min.js"
    assert asset.exists()
    assert asset.stat().st_size > 1000
