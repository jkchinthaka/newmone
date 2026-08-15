"""HACCP runtime policy stubs — no auto HOLD/NCR by default."""

from __future__ import annotations

from dataclasses import dataclass

from apps.haccp.models import ControlPoint, CorrectiveActionReference


@dataclass(frozen=True, slots=True)
class ControlPointFailureDecision:
    """Advisory decision only — never a silent disposition."""

    auto_hold: bool
    auto_ncr: bool
    reason_code: str
    procedure_reference: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "auto_hold": self.auto_hold,
            "auto_ncr": self.auto_ncr,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "advisory_only": True,
        }


def evaluate_control_point_failure_policy(
    *,
    control_point: ControlPoint,
) -> ControlPointFailureDecision:
    """
    Deterministic failure response for a control point.

    Default: no auto HOLD / no auto NCR. Opt-in flags on CorrectiveActionReference
    remain False until an explicitly approved company rule exists.
    """
    ref: CorrectiveActionReference | None
    try:
        ref = control_point.corrective_action_ref
    except CorrectiveActionReference.DoesNotExist:
        ref = None
    if ref is None:
        return ControlPointFailureDecision(
            auto_hold=False,
            auto_ncr=False,
            reason_code="NO_CORRECTIVE_REF",
        )
    # Even when references exist, auto flags default False — require explicit enablement
    # *and* future approved deterministic wiring (not implemented here as silent HOLD).
    return ControlPointFailureDecision(
        auto_hold=bool(ref.auto_raise_hold_enabled),
        auto_ncr=bool(ref.auto_raise_ncr_enabled),
        reason_code=(
            "AUTO_FLAGS_CONFIGURED"
            if (ref.auto_raise_hold_enabled or ref.auto_raise_ncr_enabled)
            else "CORRECTIVE_REF_ADVISORY_ONLY"
        ),
        procedure_reference=ref.procedure_reference,
    )
