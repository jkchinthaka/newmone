"""Company-provided source form register — SOURCE RECEIVED, not business approved.

Temperature ranges and sample counts below are copied from the supplied paper
forms. They are versioned digital draft mappings, not owner-approved SOP.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Final

from django.core.exceptions import ValidationError


@dataclass(frozen=True, slots=True)
class ControlledFormSpec:
    code: str
    title: str
    issued: str
    revision: str
    revision_date: str
    source_status: str
    business_status: str
    print_orientation: str
    notes: tuple[str, ...]


CONTROLLED_FORMS: Final[tuple[ControlledFormSpec, ...]] = (
    ControlledFormSpec(
        code="NMS/PPU/CL/24",
        title="Daily Cleaning Verification",
        issued="02.02.2018",
        revision="00",
        revision_date="00.00.0000",
        source_status="SOURCE RECEIVED",
        business_status="BUSINESS APPROVAL REQUIRED",
        print_orientation="portrait",
        notes=(
            "Acceptable/Unacceptable mapped to YES/NO for operator speed.",
            "Do not auto-create NCR/CAPA from Unacceptable.",
        ),
    ),
    ControlledFormSpec(
        code="NMS/PPU/CL/39",
        title="Product Temperature Record – Inside Cold Room",
        issued="29.11.2022",
        revision="00",
        revision_date="00.00.0000",
        source_status="SOURCE RECEIVED",
        business_status="BUSINESS APPROVAL REQUIRED",
        print_orientation="landscape",
        notes=(
            "SOURCE SCHEDULE AMBIGUITY — BUSINESS CONFIRMATION REQUIRED: "
            "procedure says every 6 hours; printed slots are 00:00–8:00, "
            "8:00–12:00, 12:00–6:00.",
            "Documented target -15°C to -18°C is source-form text, not an approved CCP.",
        ),
    ),
    ControlledFormSpec(
        code="NMS/PPU/CL/30",
        title="Inspection Record for Freezer Truck",
        issued="10.08.2016",
        revision="01",
        revision_date="15/03/2018",
        source_status="SOURCE RECEIVED",
        business_status="BUSINESS APPROVAL REQUIRED",
        print_orientation="portrait",
        notes=("FAIL is visible and auditable. No automatic dispatch block.",),
    ),
    ControlledFormSpec(
        code="NMS/PPU/CL/18",
        title="Product Dispatch Record",
        issued="02/02/2018",
        revision="01",
        revision_date="03/01/2024",
        source_status="SOURCE RECEIVED",
        business_status="BUSINESS APPROVAL REQUIRED",
        print_orientation="landscape",
        notes=(
            "SOURCE FORMAT MISMATCH — BUSINESS CONFIRMATION RECOMMENDED: "
            "procedure requires ten bulk bags; legacy print header shows 1–5.",
            "Digital model stores ten samples. Documented range -15°C to -20°C.",
            "Out-of-range evaluation is measurement-only, not QA RELEASE/HOLD/REJECT.",
        ),
    ),
)

CONTROLLED_FORM_CODES: Final[frozenset[str]] = frozenset(item.code for item in CONTROLLED_FORMS)
ONE_PER_DAY_FORM_CODES: Final[frozenset[str]] = frozenset({"NMS/PPU/CL/24"})
INDEPENDENT_OCCURRENCE_FORM_CODES: Final[frozenset[str]] = frozenset({"NMS/PPU/CL/18", "NMS/PPU/CL/30"})
ONE_PER_DAY_PER_ROOM_FORM_CODES: Final[frozenset[str]] = frozenset({"NMS/PPU/CL/39"})

DISPATCH_TEMP_MIN: Final[Decimal] = Decimal("-20")
DISPATCH_TEMP_MAX: Final[Decimal] = Decimal("-15")
COLD_ROOM_TEMP_MIN: Final[Decimal] = Decimal("-18")
COLD_ROOM_TEMP_MAX: Final[Decimal] = Decimal("-15")
DISPATCH_SAMPLE_COUNT: Final[int] = 10

COLD_ROOM_KEYS: Final[tuple[str, ...]] = ("CR1", "CR2")
COLD_ROOM_SLOT_LABELS: Final[tuple[str, ...]] = (
    "00:00 to 8:00",
    "8:00 to 12:00",
    "12:00 to 6:00",
)


def get_controlled_form(code: str) -> ControlledFormSpec | None:
    for item in CONTROLLED_FORMS:
        if item.code == code:
            return item
    return None


def is_controlled_form_code(code: str) -> bool:
    return code in CONTROLLED_FORM_CODES


def form_uses_independent_occurrences(form_code: str) -> bool:
    return form_code in INDEPENDENT_OCCURRENCE_FORM_CODES


def controlled_form_multiplicity(form_code: str) -> str:
    if form_code in ONE_PER_DAY_PER_ROOM_FORM_CODES:
        return "one_per_day_per_room"
    if form_uses_independent_occurrences(form_code):
        return "independent_occurrence"
    return "one_per_day"


_OCCURRENCE_TOKEN_RE = re.compile(r"^[A-Za-z0-9._-]{8,80}$")


def normalize_occurrence_token(token: str) -> str:
    safe = (token or "").strip()
    if not safe:
        raise ValidationError({"occurrence_token": "Occurrence token is required for this form."})
    if not _OCCURRENCE_TOKEN_RE.fullmatch(safe):
        raise ValidationError({"occurrence_token": "Occurrence token is invalid."})
    return safe
