"""Phase 06J UX helper coverage for condition_slot (non-authoritative)."""

from __future__ import annotations

from types import SimpleNamespace

from apps.recording.templatetags.recording_extras import condition_slot


def test_condition_slot_defaults_and_lookup() -> None:
    item = SimpleNamespace(id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", is_required=True)
    assert condition_slot(None, item)["visible"] is True
    assert condition_slot({}, item)["required"] is True
    flags = {
        (item.id, 1): {"visible": False, "required": False, "evidence_required": True},
    }
    meta = condition_slot(flags, item, 1)
    assert meta["visible"] is False
    assert meta["required"] is False
    assert meta["evidence_required"] is True
