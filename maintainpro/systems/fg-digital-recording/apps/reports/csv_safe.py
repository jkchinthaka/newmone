"""CSV safety helpers — formula injection protection."""

from __future__ import annotations

import csv
import io
from collections.abc import Iterable, Mapping, Sequence

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_cell(value: object) -> str:
    """
    Coerce a cell to text and neutralize spreadsheet formula injection.

    Excel/LibreOffice treat leading =+-@ as formulas. Prefix with a single quote
    (exported as text) when detected. None becomes empty string.
    """
    if value is None:
        return ""
    text = str(value)
    if text and text[0] in _FORMULA_PREFIXES:
        return f"'{text}"
    return text


def render_csv(
    *,
    headers: Sequence[str],
    rows: Iterable[Mapping[str, object] | Sequence[object]],
) -> str:
    """Render a CSV document with sanitized cells (UTF-8 text)."""
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow([sanitize_csv_cell(h) for h in headers])
    for row in rows:
        if isinstance(row, Mapping):
            writer.writerow([sanitize_csv_cell(row.get(h, "")) for h in headers])
        else:
            writer.writerow([sanitize_csv_cell(v) for v in row])
    return buffer.getvalue()
