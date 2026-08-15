"""
Evidence-driven report catalogue — Phase 16.

Codes are technical catalogue entries only. Official Nelna report packs,
compliance claims, and pilot distribution lists remain EVIDENCE REQUIRED.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final


class ReportCode(StrEnum):
    BATCH_CHECKLIST = "BATCH_CHECKLIST"
    SUBMISSION_HISTORY = "SUBMISSION_HISTORY"
    SUPERVISOR_REVIEW = "SUPERVISOR_REVIEW"
    QA_DISPOSITION = "QA_DISPOSITION"
    CORRECTIONS = "CORRECTIONS"
    HOLD_NCR_CAPA = "HOLD_NCR_CAPA"
    OVERDUE_TASKS = "OVERDUE_TASKS"
    AUDIT_EVENTS = "AUDIT_EVENTS"
    INTEGRATION_FAILURES = "INTEGRATION_FAILURES"


@dataclass(frozen=True, slots=True)
class ReportDefinition:
    code: ReportCode
    title: str
    description: str
    uses_immutable_snapshots: bool
    export_formats: tuple[str, ...]
    notes: str = ""


REPORT_CATALOGUE: Final[tuple[ReportDefinition, ...]] = (
    ReportDefinition(
        code=ReportCode.BATCH_CHECKLIST,
        title="Batch checklist tasks",
        description="Organization-scoped checklist tasks filtered by batch/site/shift.",
        uses_immutable_snapshots=False,
        export_formats=("CSV",),
        notes="Task metadata only — not draft response values.",
    ),
    ReportDefinition(
        code=ReportCode.SUBMISSION_HISTORY,
        title="Submission history",
        description="Immutable ChecklistSubmission rows (never mutable draft responses).",
        uses_immutable_snapshots=True,
        export_formats=("CSV",),
    ),
    ReportDefinition(
        code=ReportCode.SUPERVISOR_REVIEW,
        title="Supervisor reviews",
        description="Immutable SupervisorReview decisions bound to submissions.",
        uses_immutable_snapshots=True,
        export_formats=("CSV",),
    ),
    ReportDefinition(
        code=ReportCode.QA_DISPOSITION,
        title="QA dispositions",
        description="Immutable QAReview RELEASE/HOLD/REJECT labels.",
        uses_immutable_snapshots=True,
        export_formats=("CSV",),
    ),
    ReportDefinition(
        code=ReportCode.CORRECTIONS,
        title="Checklist corrections",
        description="Controlled correction cycles (distinct from formal NCR).",
        uses_immutable_snapshots=True,
        export_formats=("CSV",),
    ),
    ReportDefinition(
        code=ReportCode.HOLD_NCR_CAPA,
        title="HOLD / NCR / CAPA cases",
        description="Quality-case headers (no invented severity matrices).",
        uses_immutable_snapshots=False,
        export_formats=("CSV",),
    ),
    ReportDefinition(
        code=ReportCode.OVERDUE_TASKS,
        title="Overdue checklist tasks",
        description="Tasks with due_at in the past and not cancelled/completed.",
        uses_immutable_snapshots=False,
        export_formats=("CSV",),
    ),
    ReportDefinition(
        code=ReportCode.AUDIT_EVENTS,
        title="Security audit events",
        description="Append-only security audit catalogue export (metadata only).",
        uses_immutable_snapshots=False,
        export_formats=("CSV",),
        notes="Sensitive export — audited when exported.",
    ),
    ReportDefinition(
        code=ReportCode.INTEGRATION_FAILURES,
        title="Integration / batch-event failures",
        description="External batch event receipts in failure statuses (no live ERP write).",
        uses_immutable_snapshots=False,
        export_formats=("CSV",),
    ),
)


def get_report_definition(code: str) -> ReportDefinition:
    for item in REPORT_CATALOGUE:
        if item.code == code or item.code.value == code:
            return item
    raise KeyError(code)


def catalogue_as_dicts() -> list[dict[str, object]]:
    return [
        {
            "code": d.code.value,
            "title": d.title,
            "description": d.description,
            "uses_immutable_snapshots": d.uses_immutable_snapshots,
            "export_formats": list(d.export_formats),
            "notes": d.notes,
        }
        for d in REPORT_CATALOGUE
    ]
