"""Runtime type guards for request/auth paths — avoid assert (stripped under -O)."""

from __future__ import annotations

from typing import Any

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractUser


def require_model_choice_field(field: forms.Field, *, name: str) -> forms.ModelChoiceField[Any]:
    """Return field as ModelChoiceField or raise TypeError (never rely on assert)."""
    if not isinstance(field, forms.ModelChoiceField):
        raise TypeError(f"{name} must be a ModelChoiceField, got {type(field)!r}.")
    return field


def require_user_instance[T: AbstractUser](value: T, *, context: str = "user") -> T:
    """Return value as the configured auth user model or raise TypeError."""
    user_model = get_user_model()
    if not isinstance(value, user_model):
        raise TypeError(f"{context} must be the configured user model, got {type(value)!r}.")
    return value
