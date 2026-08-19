"""JSON envelope helpers for the Next.js FG presentation layer.

Does not reimplement FG business rules. Never includes stack traces or secrets.
"""

from __future__ import annotations

from typing import Any

from django.http import JsonResponse


def json_ok(data: Any, *, meta: dict[str, Any] | None = None, status: int = 200) -> JsonResponse:
    return JsonResponse(
        {"data": data, "meta": meta or {}, "error": None},
        status=status,
    )


def json_error(
    code: str,
    message: str,
    *,
    status: int = 400,
    field_errors: dict[str, Any] | None = None,
) -> JsonResponse:
    return JsonResponse(
        {
            "data": None,
            "meta": None,
            "error": {
                "code": code,
                "message": message,
                "fieldErrors": field_errors or {},
            },
        },
        status=status,
    )


def validation_field_errors(exc: Any) -> dict[str, list[str]]:
    if hasattr(exc, "message_dict"):
        return {
            str(key): [str(item) for item in values]
            for key, values in exc.message_dict.items()
        }
    if hasattr(exc, "messages"):
        return {"__all__": [str(item) for item in exc.messages]}
    return {"__all__": [str(exc)]}
