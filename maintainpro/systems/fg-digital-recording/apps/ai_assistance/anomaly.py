"""Advisory anomaly foundation — never accuses users of misconduct."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AdvisoryAnomaly:
    code: str
    message: str
    severity: str = "INFO"  # INFO | ADVISORY only — not a misconduct finding


def evaluate_advisory_anomalies(
    *, counts: dict[str, object] | None = None
) -> list[AdvisoryAnomaly]:
    """
    Simple threshold hints from caller-supplied counts.

    Output is advisory only. Must not claim operator fault or trigger HOLD/RELEASE.
    """
    data = counts or {}
    findings: list[AdvisoryAnomaly] = []
    overdue = data.get("overdue_tasks")
    try:
        overdue_n = int(str(overdue)) if overdue is not None else 0
    except (TypeError, ValueError):
        overdue_n = 0
    if overdue_n >= 5:
        findings.append(
            AdvisoryAnomaly(
                code="ELEVATED_OVERDUE_COUNT",
                message=(
                    "Advisory: overdue task count is elevated relative to the supplied snapshot. "
                    "Review scheduling queues; this is not an allegation of user misconduct."
                ),
                severity="ADVISORY",
            )
        )
    mapping_failed = data.get("mapping_failed_events")
    try:
        map_n = int(str(mapping_failed)) if mapping_failed is not None else 0
    except (TypeError, ValueError):
        map_n = 0
    if map_n >= 1:
        findings.append(
            AdvisoryAnomaly(
                code="MAPPING_FAILURES_PRESENT",
                message=(
                    "Advisory: mapping-failed integration events are present in the "
                    "supplied counts. Reconcile external codes; no user accusation is "
                    "implied."
                ),
                severity="ADVISORY",
            )
        )
    return findings
