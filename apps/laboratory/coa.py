"""Future Certificate of Analysis (COA) interfaces — Phase 22 hooks only.

No COA template, PDF layout, or Nelna certificate content is implemented here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True, slots=True)
class CoaResultLine:
    """Neutral COA line DTO — populated only from authorized finalized results."""

    parameter_code: str
    parameter_name: str
    result_display: str
    unit: str
    method_code: str
    result_id: UUID
    revision_number: int


@dataclass(frozen=True, slots=True)
class CoaDraftPayload:
    """Draft payload for a future generator — never auto-released."""

    organization_id: UUID
    sample_id: UUID
    batch_reference: str
    product_code: str
    lines: tuple[CoaResultLine, ...]
    advisory_only: bool = True


class CoaPayloadBuilder(Protocol):
    """Protocol for future COA builders (PDF/Excel/etc.)."""

    def build_for_sample(self, *, sample_id: UUID) -> CoaDraftPayload: ...


def empty_coa_payload(
    *,
    organization_id: UUID,
    sample_id: UUID,
    batch_reference: str = "",
    product_code: str = "",
) -> CoaDraftPayload:
    """Placeholder factory — returns an empty advisory draft."""
    return CoaDraftPayload(
        organization_id=organization_id,
        sample_id=sample_id,
        batch_reference=batch_reference,
        product_code=product_code,
        lines=(),
        advisory_only=True,
    )
