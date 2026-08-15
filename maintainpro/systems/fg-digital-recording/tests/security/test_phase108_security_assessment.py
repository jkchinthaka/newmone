"""Phase 108 — security remediation regression tests."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest
from apps.accounts.models import User
from apps.core.type_guards import require_model_choice_field, require_user_instance
from django import forms

from tests.factories import make_user

ROOT = Path(__file__).resolve().parents[2]


def test_require_model_choice_field_accepts_and_rejects() -> None:
    field = forms.ModelChoiceField(queryset=User.objects.none())
    assert require_model_choice_field(field, name="organization") is field
    with pytest.raises(TypeError, match="ModelChoiceField"):
        require_model_choice_field(forms.CharField(), name="organization")


@pytest.mark.django_db
def test_require_user_instance_accepts_and_rejects() -> None:
    user = make_user(employee_code="SEC108A1")
    assert require_user_instance(user, context="login") is user
    with pytest.raises(TypeError, match="configured user model"):
        require_user_instance(object(), context="login")  # type: ignore[arg-type]


def test_bandit_b101_cleared_on_runtime_apps() -> None:
    """Regression: request/auth paths must not rely on assert (stripped under -O)."""
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "bandit",
            "-q",
            "-r",
            "apps",
            "config",
            "-x",
            "*/migrations/*,*/tests/*,apps/mongo_poc/*",
            "-t",
            "B101",
            "-f",
            "json",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    # bandit returns 1 when issues found; 0 when clean
    assert proc.returncode in {0, 1}
    payload = proc.stdout.strip() or "{}"
    import json

    data = json.loads(payload) if payload.startswith("{") else {"results": []}
    results = data.get("results") or []
    assert results == [], f"Unexpected B101 findings: {results!r}"
