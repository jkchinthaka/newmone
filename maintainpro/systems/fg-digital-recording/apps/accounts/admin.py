"""Safe Django admin for the User model — no password display in list/detail."""

from __future__ import annotations

from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.http import HttpRequest
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.services import unlock_account
from apps.accounts.validators import normalize_employee_code


class EmployeeUserCreationForm(UserCreationForm):  # type: ignore[type-arg]
    """Admin add-user form: employee_code is mandatory for application accounts."""

    class Meta:
        model = User
        fields = ("username", "employee_code")

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self.fields["employee_code"].required = True

    def clean_employee_code(self) -> str:
        code = normalize_employee_code(str(self.cleaned_data.get("employee_code") or ""))
        if not code:
            raise forms.ValidationError("Employee code is required.")
        return code


class EmployeeUserChangeForm(UserChangeForm):  # type: ignore[type-arg]
    class Meta:
        model = User
        fields = "__all__"

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self.fields["employee_code"].required = True

    def clean_employee_code(self) -> str:
        code = normalize_employee_code(str(self.cleaned_data.get("employee_code") or ""))
        if not code:
            raise forms.ValidationError("Employee code is required.")
        return code


@admin.register(User)
class UserAdmin(DjangoUserAdmin):  # type: ignore[type-arg]
    form = EmployeeUserChangeForm
    add_form = EmployeeUserCreationForm
    ordering = ("employee_code", "username")
    list_display = (
        "employee_code",
        "username",
        "email",
        "maintainpro_user_id",
        "is_staff",
        "is_active",
        "must_change_password",
        "failed_login_count",
        "locked_until",
        "date_joined",
    )
    list_filter = ("is_staff", "is_active", "must_change_password", "is_superuser")
    search_fields = (
        "employee_code",
        "username",
        "email",
        "first_name",
        "last_name",
        "maintainpro_user_id",
        "maintainpro_email",
    )
    readonly_fields = (
        "id",
        "last_login",
        "date_joined",
        "password_changed_at",
        "failed_login_count",
        "locked_until",
        "last_failed_login_at",
        "last_successful_login_at",
        "maintainpro_user_id",
        "maintainpro_email",
        "maintainpro_synced_at",
    )
    actions = ("unlock_selected_accounts",)

    fieldsets = (
        (None, {"fields": ("id", "username", "employee_code", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "email")}),
        (
            "MaintainPro identity (projection — do not set local passwords)",
            {
                "fields": (
                    "maintainpro_user_id",
                    "maintainpro_email",
                    "maintainpro_synced_at",
                )
            },
        ),
        (
            "Password and lockout",
            {
                "fields": (
                    "must_change_password",
                    "password_changed_at",
                    "failed_login_count",
                    "locked_until",
                    "last_failed_login_at",
                    "last_successful_login_at",
                )
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "employee_code",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                    "must_change_password",
                ),
            },
        ),
    )

    @admin.action(description="Unlock selected accounts")
    def unlock_selected_accounts(
        self,
        request: HttpRequest,
        queryset: object,
    ) -> None:
        actor = request.user if isinstance(request.user, User) else None
        count = 0
        for user in queryset:  # type: ignore[attr-defined]
            unlock_account(user, actor=actor, request=request)
            count += 1
        self.message_user(request, f"Unlocked {count} account(s).", messages.SUCCESS)

    def save_model(
        self,
        request: HttpRequest,
        obj: User,
        form: object,
        change: bool,
    ) -> None:
        previous_active: bool | None = None
        if change and obj.pk:
            previous = User.objects.filter(pk=obj.pk).values_list("is_active", flat=True).first()
            previous_active = previous

        # Projected MaintainPro principals must never receive a usable local password.
        if str(getattr(obj, "maintainpro_user_id", "") or "").strip():
            obj.set_unusable_password()
            obj.must_change_password = False
            obj.employee_code = None

        super().save_model(request, obj, form, change)

        changed_data = list(getattr(form, "changed_data", []))
        if change and previous_active is not None and previous_active != obj.is_active:
            from apps.security_audit.services import record_event

            event_type = "USER_ACTIVATED" if obj.is_active else "USER_DEACTIVATED"
            record_event(
                event_type=event_type,
                actor=request.user if isinstance(request.user, User) else None,
                subject_user=obj,
                request_id=getattr(request, "correlation_id", None),
                ip_address=request.META.get("REMOTE_ADDR"),
                user_agent_summary=(request.META.get("HTTP_USER_AGENT") or "")[:512],
                metadata={},
            )

        if change and "password" in changed_data:
            if str(getattr(obj, "maintainpro_user_id", "") or "").strip():
                obj.set_unusable_password()
                obj.must_change_password = False
                obj.save(update_fields=["password", "must_change_password"])
                self.message_user(
                    request,
                    "MaintainPro-projected users cannot have local passwords.",
                    messages.WARNING,
                )
                return
            obj.password_changed_at = timezone.now()
            if settings.AUTH_PASSWORD_CHANGE_REQUIRED_ON_ADMIN_RESET:
                obj.must_change_password = True
            obj.save(update_fields=["password_changed_at", "must_change_password"])
