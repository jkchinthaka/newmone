"""Packaging artwork verification helpers — no invented pass/fail label rules."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from apps.packaging.models import ArtworkVersion, ArtworkVersionStatus
from apps.packaging.snapshots import artwork_version_is_effective


@dataclass(frozen=True, slots=True)
class ArtworkMatchDecision:
    matched: bool
    reason_code: str
    message: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "matched": self.matched,
            "reason_code": self.reason_code,
            "message": self.message,
            "not_qa_disposition": True,
            "evidence_gate": "APR-055 / company packaging artwork verification policy",
        }


def assert_artwork_matches_expected(
    *,
    expected_version: ArtworkVersion,
    observed_artwork_version_id: UUID | None,
) -> ArtworkMatchDecision:
    """
    Compare observed artwork version identity to the bound expected version.

    Wrong artwork / wrong version → matched=False. Does not invent customer rules.
    """
    if observed_artwork_version_id is None:
        return ArtworkMatchDecision(
            matched=False,
            reason_code="ARTWORK_NOT_PROVIDED",
            message="No observed artwork version supplied for verification.",
        )
    if expected_version.status != ArtworkVersionStatus.APPROVED:
        return ArtworkMatchDecision(
            matched=False,
            reason_code="EXPECTED_NOT_APPROVED",
            message="Expected artwork version is not APPROVED.",
        )
    if not artwork_version_is_effective(expected_version):
        return ArtworkMatchDecision(
            matched=False,
            reason_code="EXPECTED_NOT_EFFECTIVE",
            message="Expected artwork version is outside its effective date window.",
        )
    if observed_artwork_version_id != expected_version.id:
        return ArtworkMatchDecision(
            matched=False,
            reason_code="WRONG_ARTWORK_VERSION",
            message="Observed artwork version does not match the bound approved version.",
        )
    return ArtworkMatchDecision(
        matched=True,
        reason_code="MATCHED",
        message="Observed artwork version matches expected approved version.",
    )
