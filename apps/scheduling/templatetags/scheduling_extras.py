"""Scheduling template tags for navigation affordances and due badges."""

from __future__ import annotations

from typing import Any

from django import template

from apps.scheduling.due import due_display_badge_class
from apps.scheduling.selectors import actor_can_view_checklist_tasks

register = template.Library()


@register.simple_tag(takes_context=True)
def user_can_view_checklist_tasks(context: dict[str, Any]) -> bool:
    request = context.get("request")
    user = getattr(request, "user", None) if request is not None else None
    return actor_can_view_checklist_tasks(user)


@register.simple_tag
def due_badge_class(state: str | None) -> str:
    return due_display_badge_class(state or "NOT_DUE")
