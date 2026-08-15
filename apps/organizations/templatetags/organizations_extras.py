"""Organization template helpers."""

from __future__ import annotations

from typing import Any

from django import template

from apps.organizations.selectors import actor_can_manage_shifts, actor_can_view_shifts

register = template.Library()


@register.simple_tag(takes_context=True)
def user_can_view_shifts(context: dict[str, Any]) -> bool:
    request = context.get("request")
    user = getattr(request, "user", None) if request is not None else None
    return actor_can_view_shifts(user)


@register.simple_tag(takes_context=True)
def user_can_manage_shifts(context: dict[str, Any]) -> bool:
    request = context.get("request")
    user = getattr(request, "user", None) if request is not None else None
    return actor_can_manage_shifts(user)
