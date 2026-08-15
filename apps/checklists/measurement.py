"""Measurement semantics helpers (Phase 06M / ADR-019 section 4).

Technical vocabulary only — not Nelna-specific product units or limits.
Which catalog units Nelna uses in production remains EVIDENCE REQUIRED.
Never invent Product temperature classes or company unit mappings.

Decimal-safe: parse/store via Decimal (never binary float as authority).
Rounding applies only when BOTH decimal_precision and rounding_mode are set.
Informational min/max with explicit inclusivity do not alone HOLD/REJECT/RELEASE.
"""

from __future__ import annotations

from decimal import (
    ROUND_CEILING,
    ROUND_DOWN,
    ROUND_FLOOR,
    ROUND_HALF_EVEN,
    ROUND_HALF_UP,
    Decimal,
    InvalidOperation,
)
from typing import Any

from django.core.exceptions import ValidationError

TECHNICAL_UNIT_CATALOG: dict[str, str] = {
    "": "(no unit)",
    "C": "°C",
    "F": "°F",
    "K": "K",
    "g": "g",
    "kg": "kg",
    "mg": "mg",
    "L": "L",
    "mL": "mL",
    "mm": "mm",
    "cm": "cm",
    "m": "m",
    "pct": "%",
    "ppm": "ppm",
    "count": "count",
    "s": "s",
    "min": "min",
    "h": "h",
}

KNOWN_UNITS = frozenset(TECHNICAL_UNIT_CATALOG.keys())
TECHNICAL_UNIT_CODES = frozenset(u for u in KNOWN_UNITS if u)

ROUNDING_MODE_TO_DECIMAL: dict[str, str] = {
    "HALF_UP": ROUND_HALF_UP,
    "HALF_EVEN": ROUND_HALF_EVEN,
    "FLOOR": ROUND_FLOOR,
    "CEILING": ROUND_CEILING,
    "DOWN": ROUND_DOWN,
}

KNOWN_ROUNDING_MODES = frozenset(ROUNDING_MODE_TO_DECIMAL.keys())

MEASUREMENT_NOT_DISPOSITION_NOTE = (
    "Informational measurement bounds and rounding are not a QA disposition. "
    "They do not HOLD, REJECT, or RELEASE product."
)

_UNIT_ALIASES = {
    "°C": "C",
    "DEG_C": "C",
    "CELSIUS": "C",
    "°F": "F",
    "DEG_F": "F",
    "FAHRENHEIT": "F",
    "%": "pct",
    "PERCENT": "pct",
    "ML": "mL",
    "MIN": "min",
    "H": "h",
    "S": "s",
    "KG": "kg",
    "G": "g",
    "MG": "mg",
    "MM": "mm",
    "CM": "cm",
    "M": "m",
    "PPM": "ppm",
    "COUNT": "count",
    "L": "L",
    "K": "K",
    "C": "C",
    "F": "F",
}


def assert_known_unit(code: str | None) -> str:
    """Blank OK. Unknown free-form codes are rejected."""
    raw = "" if code is None else str(code).strip()
    if raw == "":
        return ""
    if raw in KNOWN_UNITS:
        return raw
    if raw in _UNIT_ALIASES:
        return _UNIT_ALIASES[raw]
    upper = raw.upper()
    if upper in _UNIT_ALIASES:
        return _UNIT_ALIASES[upper]
    for known in KNOWN_UNITS:
        if known and known.lower() == raw.lower():
            return known
    allowed = ", ".join(sorted(u for u in KNOWN_UNITS if u))
    raise ValidationError(
        {
            "unit": (
                f"Unknown unit {code!r}. Use a technical catalog code or blank. "
                f"Allowed: {allowed}. "
                "Nelna production unit selection remains evidence-gated."
            )
        }
    )


def unit_display_label(code: str | None) -> str:
    if code in (None, ""):
        return TECHNICAL_UNIT_CATALOG[""]
    try:
        normalized = assert_known_unit(code)
    except ValidationError:
        return str(code or "")
    return TECHNICAL_UNIT_CATALOG.get(normalized, normalized or "(no unit)")


def assert_known_rounding_mode(mode: str | None) -> str:
    """Empty string means no rounding applied."""
    normalized = (mode or "").strip().upper()
    if not normalized:
        return ""
    if normalized not in KNOWN_ROUNDING_MODES:
        allowed = ", ".join(sorted(KNOWN_ROUNDING_MODES))
        raise ValidationError(
            {"rounding_mode": (f"Unknown rounding_mode {mode!r}. Allowed blank or: {allowed}.")}
        )
    return normalized


# Technical ceiling for optional decimal_precision (0–12 inclusive).
# Not a Nelna product policy — storage DecimalField places match this ceiling.
DECIMAL_PRECISION_MAX = 12


def normalize_decimal_precision(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        precision = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(
            {"decimal_precision": "decimal_precision must be a non-negative integer or blank."}
        ) from exc
    if precision < 0:
        raise ValidationError({"decimal_precision": "decimal_precision cannot be negative."})
    if precision > DECIMAL_PRECISION_MAX:
        raise ValidationError(
            {
                "decimal_precision": (
                    f"decimal_precision technical ceiling is {DECIMAL_PRECISION_MAX} "
                    "(0–12 inclusive; null = no forced quantize)."
                )
            }
        )
    return precision


assert_decimal_precision = normalize_decimal_precision


def parse_decimal_strict(raw: Any) -> Decimal:
    """Parse measurement from str path — never treat binary float as authority."""
    if isinstance(raw, Decimal):
        return raw
    if isinstance(raw, bool):
        raise ValidationError({"number": "Enter a valid number."})
    if isinstance(raw, int):
        return Decimal(raw)
    if isinstance(raw, float):
        try:
            return Decimal(str(raw))
        except (InvalidOperation, ValueError) as exc:
            raise ValidationError({"number": "Enter a valid number."}) from exc
    try:
        text = str(raw).strip()
    except (TypeError, AttributeError) as exc:
        raise ValidationError({"number": "Enter a valid number."}) from exc
    if not text:
        raise ValidationError({"number": "Enter a valid number."})
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError({"number": "Enter a valid number."}) from exc


def apply_configured_rounding(
    value: Decimal,
    precision: int | None,
    mode: str | None,
) -> tuple[Decimal, bool]:
    """Quantize ONLY when both decimal_precision and rounding_mode are configured."""
    mode_norm = assert_known_rounding_mode(mode)
    if precision is None or not mode_norm:
        return value, False
    quant = Decimal("1").scaleb(-int(precision))
    rounded = value.quantize(quant, rounding=ROUNDING_MODE_TO_DECIMAL[mode_norm])
    return rounded, True


def format_decimal_for_display(value: Decimal | None, precision: int | None = None) -> str:
    """Format Decimal without binary float artifacts."""
    if value is None:
        return "—"
    if not isinstance(value, Decimal):
        value = parse_decimal_strict(value)
    if precision is not None:
        quant = Decimal("1").scaleb(-int(precision))
        text = format(value.quantize(quant, rounding=ROUND_HALF_EVEN), "f")
    else:
        text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def format_measurement_decimal(
    value: Decimal | None,
    *,
    decimal_precision: int | None = None,
) -> str:
    return format_decimal_for_display(value, decimal_precision)


def value_within_informational_bounds(
    value: Decimal,
    minimum: Decimal | None,
    maximum: Decimal | None,
    min_inclusive: bool = True,
    max_inclusive: bool = True,
) -> bool | None:
    if minimum is None and maximum is None:
        return None
    if minimum is not None:
        if min_inclusive:
            if value < minimum:
                return False
        elif value <= minimum:
            return False
    if maximum is not None:
        if max_inclusive:
            if value > maximum:
                return False
        elif value >= maximum:
            return False
    return True


def informational_bound_contains(
    value: Decimal,
    *,
    minimum_value: Decimal | None,
    maximum_value: Decimal | None,
    min_inclusive: bool,
    max_inclusive: bool,
) -> bool:
    result = value_within_informational_bounds(
        value,
        minimum_value,
        maximum_value,
        min_inclusive=min_inclusive,
        max_inclusive=max_inclusive,
    )
    return True if result is None else result


def build_measurement_context(
    *,
    value: Decimal | None = None,
    number_value: Decimal | None = None,
    unit: str = "",
    decimal_precision: int | None = None,
    rounding_mode: str = "",
    rounding_applied: bool = False,
    minimum_value: Decimal | None = None,
    maximum_value: Decimal | None = None,
    min_inclusive: bool = True,
    max_inclusive: bool = True,
) -> dict[str, Any]:
    resolved = value if value is not None else number_value
    unit_code = assert_known_unit(unit) if unit else ""
    mode = assert_known_rounding_mode(rounding_mode)
    if resolved is None:
        captured = None
        within = None
    else:
        if not isinstance(resolved, Decimal):
            resolved = parse_decimal_strict(resolved)
        captured = format(resolved, "f")
        within = value_within_informational_bounds(
            resolved,
            minimum_value,
            maximum_value,
            min_inclusive=bool(min_inclusive),
            max_inclusive=bool(max_inclusive),
        )
    return {
        "captured_value": captured,
        "number_value": captured,
        "unit": unit_code,
        "unit_label": TECHNICAL_UNIT_CATALOG.get(unit_code, unit_code or "(no unit)"),
        "decimal_precision": decimal_precision,
        "rounding_mode": mode,
        "rounding_applied": bool(rounding_applied),
        "minimum_value": format(minimum_value, "f") if minimum_value is not None else None,
        "maximum_value": format(maximum_value, "f") if maximum_value is not None else None,
        "min_inclusive": bool(min_inclusive),
        "max_inclusive": bool(max_inclusive),
        "within_informational_bounds": within,
        "not_qa_disposition": True,
        "qa_disposition_note": MEASUREMENT_NOT_DISPOSITION_NOTE,
        "serialization": "decimal-as-string",
        "not_product_spec": True,
    }


def serialize_measurement_for_mongo(context_or_decimal: Any) -> Any:
    if isinstance(context_or_decimal, Decimal):
        return format(context_or_decimal, "f")
    if isinstance(context_or_decimal, dict):
        return {k: serialize_measurement_for_mongo(v) for k, v in context_or_decimal.items()}
    if isinstance(context_or_decimal, list):
        return [serialize_measurement_for_mongo(v) for v in context_or_decimal]
    return context_or_decimal


def decimal_to_mongo_safe(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return str(serialize_measurement_for_mongo(value))


def mongo_safe_to_decimal(raw: Any) -> Decimal | None:
    if raw is None or raw == "":
        return None
    return parse_decimal_strict(raw)


def apply_measurement_decimal(
    raw: Any,
    *,
    decimal_precision: int | None = None,
    rounding_mode: str = "",
) -> Decimal:
    parsed = parse_decimal_strict(raw if not isinstance(raw, float) else str(raw))
    rounded, _applied = apply_configured_rounding(parsed, decimal_precision, rounding_mode)
    return rounded


def quantize_for_precision(
    value: Decimal,
    *,
    decimal_precision: int | None,
    rounding_mode: str,
) -> Decimal:
    rounded, _ = apply_configured_rounding(value, decimal_precision, rounding_mode)
    return rounded


def assert_precision_rounding_pair(
    *,
    decimal_precision: Any,
    rounding_mode: str | None,
) -> tuple[int | None, str]:
    """
    Normalize optional precision + mode independently.

    Partial configuration is allowed: rounding is applied only when BOTH are set
    (see apply_configured_rounding). Precision alone may guide display; mode alone
    does not round.
    """
    precision = normalize_decimal_precision(decimal_precision)
    mode = assert_known_rounding_mode(rounding_mode)
    return precision, mode
