"""Report navigation affordances — reuse catalogue permission only."""

from __future__ import annotations

from typing import Any

from django import template

from apps.reports.selectors import organizations_for_reporting

register = template.Library()


@register.simple_tag(takes_context=True)
def user_can_view_reports(context: dict[str, Any]) -> bool:
    request = context.get("request")
    user = getattr(request, "user", None) if request is not None else None
    return organizations_for_reporting(user).exists()
