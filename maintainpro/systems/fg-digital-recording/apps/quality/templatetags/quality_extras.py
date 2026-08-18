"""Quality template helpers."""

from __future__ import annotations

from typing import Any

from django import template

from apps.quality.selectors import actor_can_access_qa_module

register = template.Library()


@register.simple_tag(takes_context=True)
def user_can_qa_review_checklist_submissions(context: dict[str, Any]) -> bool:
    request = context.get("request")
    user = getattr(request, "user", None) if request is not None else None
    return actor_can_access_qa_module(user)
