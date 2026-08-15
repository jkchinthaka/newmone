"""Authentication forms."""

from __future__ import annotations

from django import forms
from django.contrib.auth.password_validation import validate_password

from apps.accounts.validators import normalize_employee_code


class LoginForm(forms.Form):
    employee_code = forms.CharField(
        label="Employee code",
        max_length=64,
        widget=forms.TextInput(
            attrs={
                "autocomplete": "username",
                "autocapitalize": "characters",
                "class": "form-input",
                "inputmode": "text",
            }
        ),
    )
    password = forms.CharField(
        label="Password",
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "autocomplete": "current-password",
                "class": "form-input",
            }
        ),
    )

    def clean_employee_code(self) -> str:
        return normalize_employee_code(self.cleaned_data["employee_code"])


class ChangePasswordForm(forms.Form):
    current_password = forms.CharField(
        label="Current password",
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "autocomplete": "current-password",
                "class": "form-input",
            }
        ),
    )
    new_password = forms.CharField(
        label="New password",
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "autocomplete": "new-password",
                "class": "form-input",
            }
        ),
    )
    confirm_password = forms.CharField(
        label="Confirm new password",
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "autocomplete": "new-password",
                "class": "form-input",
            }
        ),
    )

    def __init__(self, user: object, *args: object, **kwargs: object) -> None:
        self.user = user
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]

    def clean_new_password(self) -> str:
        password = self.cleaned_data["new_password"]
        validate_password(password, user=self.user)  # type: ignore[arg-type]
        return str(password)

    def clean(self) -> dict[str, object]:
        cleaned = super().clean()
        if cleaned is None:
            return {}
        new_password = cleaned.get("new_password")
        confirm = cleaned.get("confirm_password")
        if new_password and confirm and new_password != confirm:
            self.add_error("confirm_password", "The two password fields did not match.")
        return cleaned


class ForcePasswordChangeForm(forms.Form):
    new_password = forms.CharField(
        label="New password",
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "autocomplete": "new-password",
                "class": "form-input",
            }
        ),
    )
    confirm_password = forms.CharField(
        label="Confirm new password",
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "autocomplete": "new-password",
                "class": "form-input",
            }
        ),
    )

    def __init__(self, user: object, *args: object, **kwargs: object) -> None:
        self.user = user
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]

    def clean_new_password(self) -> str:
        password = self.cleaned_data["new_password"]
        validate_password(password, user=self.user)  # type: ignore[arg-type]
        return str(password)

    def clean(self) -> dict[str, object]:
        cleaned = super().clean()
        if cleaned is None:
            return {}
        new_password = cleaned.get("new_password")
        confirm = cleaned.get("confirm_password")
        if new_password and confirm and new_password != confirm:
            self.add_error("confirm_password", "The two password fields did not match.")
        return cleaned
