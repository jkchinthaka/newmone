"""Allowed AI use cases and prohibited autonomous actions — Phase 18."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final


class AllowedUseCase(StrEnum):
    SUMMARIZE_BATCH_HISTORY = "SUMMARIZE_BATCH_HISTORY"
    SUMMARIZE_NCR_CAPA = "SUMMARIZE_NCR_CAPA"
    EXPLAIN_REPORT_METRICS = "EXPLAIN_REPORT_METRICS"
    ASSIST_SEARCH = "ASSIST_SEARCH"
    TREND_NARRATION = "TREND_NARRATION"


class ProhibitedAction(StrEnum):
    """Actions AI must never autonomously perform or claim authority to execute."""

    RELEASE = "RELEASE"
    HOLD = "HOLD"
    REJECT = "REJECT"
    PUBLISH_CHECKLIST = "PUBLISH_CHECKLIST"
    CHANGE_SPECIFICATION = "CHANGE_SPECIFICATION"
    CHANGE_ROLES = "CHANGE_ROLES"
    EXECUTE_ERP_DISPOSITION = "EXECUTE_ERP_DISPOSITION"
    CLOSE_CAPA = "CLOSE_CAPA"
    DECLARE_ROOT_CAUSE_AS_FACT = "DECLARE_ROOT_CAUSE_AS_FACT"


@dataclass(frozen=True, slots=True)
class UseCaseDefinition:
    code: AllowedUseCase
    title: str
    description: str


USE_CASE_CATALOGUE: Final[tuple[UseCaseDefinition, ...]] = (
    UseCaseDefinition(
        code=AllowedUseCase.SUMMARIZE_BATCH_HISTORY,
        title="Summarize batch history",
        description="Advisory summary of authorized batch-linked task/event metadata.",
    ),
    UseCaseDefinition(
        code=AllowedUseCase.SUMMARIZE_NCR_CAPA,
        title="Summarize NCR/CAPA",
        description="Advisory summary of authorized quality-case headers (not root-cause facts).",
    ),
    UseCaseDefinition(
        code=AllowedUseCase.EXPLAIN_REPORT_METRICS,
        title="Explain report metrics",
        description="Explain provided metric labels/counts already authorized for the user.",
    ),
    UseCaseDefinition(
        code=AllowedUseCase.ASSIST_SEARCH,
        title="Assist search",
        description="Help locate authorized record identifiers/codes within org scope.",
    ),
    UseCaseDefinition(
        code=AllowedUseCase.TREND_NARRATION,
        title="Trend narration",
        description="Narrative over caller-supplied counts only — no invented trends.",
    ),
)


PROHIBITED_PHRASE_HINTS: Final[dict[ProhibitedAction, tuple[str, ...]]] = {
    ProhibitedAction.RELEASE: ("release the batch", "set disposition to release", "auto release"),
    ProhibitedAction.HOLD: ("place on hold", "set disposition to hold", "auto hold"),
    ProhibitedAction.REJECT: ("reject the batch", "set disposition to reject", "auto reject"),
    ProhibitedAction.PUBLISH_CHECKLIST: (
        "publish checklist",
        "publish the template",
        "publish version",
    ),
    ProhibitedAction.CHANGE_SPECIFICATION: (
        "change specification",
        "update spec limits",
        "edit specification",
    ),
    ProhibitedAction.CHANGE_ROLES: ("change roles", "assign role", "grant permission"),
    ProhibitedAction.EXECUTE_ERP_DISPOSITION: (
        "send to erp",
        "post disposition to bileeta",
        "erp disposition",
    ),
    ProhibitedAction.CLOSE_CAPA: ("close capa", "close the capa", "mark capa closed"),
    ProhibitedAction.DECLARE_ROOT_CAUSE_AS_FACT: (
        "root cause is",
        "the root cause was",
        "declare root cause",
    ),
}


def catalogue_as_dicts() -> list[dict[str, str]]:
    return [
        {"code": u.code.value, "title": u.title, "description": u.description}
        for u in USE_CASE_CATALOGUE
    ]
