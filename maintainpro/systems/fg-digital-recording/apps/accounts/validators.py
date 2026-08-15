"""Account field validators and normalizers."""

from __future__ import annotations


def normalize_employee_code(value: str) -> str:
    """Strip whitespace and uppercase employee codes for consistent lookup."""
    return value.strip().upper()
