"""Master data template helpers."""

from __future__ import annotations

from typing import Any

from django import template

from apps.master_data.selectors import actor_can_manage_fg_products, actor_can_view_fg_products

register = template.Library()


@register.simple_tag(takes_context=True)
def user_can_view_fg_products(context: dict[str, Any]) -> bool:
    request = context.get("request")
    user = getattr(request, "user", None) if request is not None else None
    return actor_can_view_fg_products(user)


@register.simple_tag(takes_context=True)
def user_can_manage_fg_products(context: dict[str, Any]) -> bool:
    request = context.get("request")
    user = getattr(request, "user", None) if request is not None else None
    return actor_can_manage_fg_products(user)
