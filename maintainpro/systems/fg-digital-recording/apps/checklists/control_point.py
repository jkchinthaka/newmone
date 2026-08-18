"""Control-point / food-safety metadata helpers (Phase 06L / ADR-019 §8).

Metadata is display/reporting extensibility only until an approved deterministic
policy exists. It never creates HOLD/REJECT/RELEASE, NCR, or dispatch blocks.
"""

from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError

from apps.checklists.models import (
    ChecklistControlPointClass,
    ChecklistItemCriticality,
)

CONTROL_POINT_CLASSES = frozenset(ChecklistControlPointClass.values)
CRITICALITY_VALUES = frozenset(ChecklistItemCriticality.values)

METADATA_DISPOSITION_NOTE = (
    "Control-point / criticality metadata is not a QA disposition. "
    "It does not HOLD, REJECT, RELEASE, create NCR, or block dispatch."
)


def assert_known_control_point_class(value: str) -> str:
    normalized = (value or "").strip().upper() or ChecklistControlPointClass.NONE
    if normalized not in CONTROL_POINT_CLASSES:
        raise ValidationError(
            {
                "control_point_class": (
                    f"Unknown control-point class {value!r}. "
                    f"Allowed: {', '.join(sorted(CONTROL_POINT_CLASSES))}."
                )
            }
        )
    return normalized


def assert_known_criticality(value: str) -> str:
    """Blank is allowed (unset). Non-blank must be MINOR/MAJOR/CRITICAL."""
    normalized = (value or "").strip().upper()
    if not normalized:
        return ""
    if normalized not in CRITICALITY_VALUES:
        raise ValidationError(
            {
                "criticality": (
                    f"Unknown criticality {value!r}. "
                    f"Allowed blank or: {', '.join(sorted(CRITICALITY_VALUES))}."
                )
            }
        )
    return normalized


def control_point_display_label(control_point_class: str | None) -> str:
    value = (control_point_class or "").strip().upper() or ChecklistControlPointClass.NONE
    try:
        return ChecklistControlPointClass(value).label
    except ValueError:
        return value


def criticality_display_label(criticality: str | None) -> str:
    value = (criticality or "").strip().upper()
    if not value:
        return "Unset"
    try:
        return ChecklistItemCriticality(value).label
    except ValueError:
        return value


def build_control_point_snapshot(
    *,
    control_point_class: str,
    criticality: str = "",
) -> dict[str, Any]:
    """Frozen definition metadata for submission historical reference."""
    return {
        "control_point_class": assert_known_control_point_class(control_point_class),
        "criticality": assert_known_criticality(criticality),
        "not_qa_disposition": True,
        "qa_disposition_note": METADATA_DISPOSITION_NOTE,
        "evidence_gate": "ASM-002 / APR-027 required for production non-NONE classifications",
    }
