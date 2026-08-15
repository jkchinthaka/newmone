from __future__ import annotations

from typing import Any

from django import template

from apps.customer_complaints.selectors import actor_can_access_complaints_module

register = template.Library()


@register.simple_tag(takes_context=True)
def user_can_view_complaints(context: dict[str, Any]) -> bool:
    request = context.get("request")
    user = getattr(request, "user", None) if request is not None else None
    return actor_can_access_complaints_module(user)
