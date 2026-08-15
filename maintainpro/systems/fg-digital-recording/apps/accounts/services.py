"""Account authentication and password lifecycle services."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.contrib.auth import login, logout
from django.core.exceptions import ValidationError
from django.db import transaction
from apps.core.persistence import atomic_fn, conditional_update, lock_queryset
from django.http import HttpRequest
from django.utils import timezone

from apps.accounts.backends import EmployeeCodeBackend
from apps.accounts.models import User
from apps.accounts.validators import normalize_employee_code

GENERIC_LOGIN_ERROR = "Unable to sign in with the provided credentials."


def _ensure_user(value: object, *, context: str) -> User:
    """Narrow UserManager Any rows to the concrete User model."""
    if not isinstance(value, User):
        raise TypeError(f"{context} must be an application User, got {type(value)!r}.")
    return value


@dataclass(frozen=True, slots=True)
class AuthResult:
    success: bool
    user: User | None = None
    locked: bool = False
    error_code: str = ""


def _max_failed_attempts() -> int:
    return int(getattr(settings, "AUTH_MAX_FAILED_ATTEMPTS", 5))


def _lockout_minutes() -> int:
    return int(getattr(settings, "AUTH_LOCKOUT_MINUTES", 15))


def _client_meta(request: HttpRequest | None) -> dict[str, Any]:
    if request is None:
        return {"request_id": None, "ip_address": None, "user_agent": ""}
    return {
        "request_id": getattr(request, "correlation_id", None),
        "ip_address": request.META.get("REMOTE_ADDR"),
        "user_agent": (request.META.get("HTTP_USER_AGENT") or "")[:512],
    }


def create_application_user(
    *,
    employee_code: str,
    password: str,
    username: str | None = None,
    is_active: bool = True,
    is_staff: bool = False,
    must_change_password: bool = False,
) -> User:
    """Create a normal application account; employee_code is mandatory."""
    normalized = normalize_employee_code(employee_code)
    if not normalized:
        raise ValidationError({"employee_code": "Employee code is required."})
    user = _ensure_user(
        User.objects.create_user(
            username=username or normalized,
            password=password,
            employee_code=normalized,
            is_active=is_active,
            is_staff=is_staff,
        ),
        context="create_user",
    )
    if must_change_password:
        user.must_change_password = True
        user.save(update_fields=["must_change_password"])
    return user


def _login_rate_limit_exceeded(request: HttpRequest) -> bool:
    """
    IP-scoped login attempt throttle (Phase 19).

    Complements per-account lockout. Failures are generic to callers.
    """
    from django.core.cache import cache

    window = int(getattr(settings, "AUTH_LOGIN_RATE_LIMIT_WINDOW", 300))
    max_attempts = int(getattr(settings, "AUTH_LOGIN_RATE_LIMIT_MAX", 40))
    if window <= 0 or max_attempts <= 0:
        return False
    ip = (request.META.get("REMOTE_ADDR") or "unknown").strip() or "unknown"
    key = f"auth:login_rate:{ip}"
    try:
        current = cache.incr(key)
    except ValueError:
        cache.add(key, 1, timeout=window)
        current = 1
    return int(current) > max_attempts


def authenticate_login(
    request: HttpRequest,
    *,
    employee_code: str,
    password: str,
) -> AuthResult:
    """
    Authenticate with employee_code + password.

    All denial outcomes are externally indistinguishable (generic failure).
    Locked accounts do not increment failure counters again.
    Audit metadata may record a non-sensitive reason for operators.
    """
    from apps.security_audit.services import record_event

    meta = _client_meta(request)
    if _login_rate_limit_exceeded(request):
        record_event(
            event_type="LOGIN_FAILURE",
            subject_user=None,
            request_id=meta["request_id"],
            ip_address=meta["ip_address"],
            user_agent_summary=meta["user_agent"],
            metadata={"reason": "rate_limited"},
            unknown_identifier="rate_limited",
        )
        return AuthResult(success=False, error_code="invalid_credentials")

    normalized = normalize_employee_code(employee_code)

    backend = EmployeeCodeBackend()
    user = backend.authenticate(
        request,
        employee_code=normalized,
        password=password,
    )

    if user is not None:
        record_successful_login(user, request=request)
        record_event(
            event_type="LOGIN_SUCCESS",
            actor=user,
            subject_user=user,
            request_id=meta["request_id"],
            ip_address=meta["ip_address"],
            user_agent_summary=meta["user_agent"],
            metadata={},
        )
        return AuthResult(success=True, user=user)

    candidate = (
        User.objects.filter(employee_code__iexact=normalized).first() if normalized else None
    )

    if candidate is None:
        record_event(
            event_type="LOGIN_FAILURE",
            subject_user=None,
            request_id=meta["request_id"],
            ip_address=meta["ip_address"],
            user_agent_summary=meta["user_agent"],
            metadata={"reason": "invalid_credentials"},
            unknown_identifier=normalized or employee_code or "empty",
        )
        return AuthResult(success=False, error_code="invalid_credentials")

    if candidate.is_locked:
        # Already locked: do not extend counters; password work already ran in backend.
        record_event(
            event_type="LOGIN_FAILURE",
            subject_user=candidate,
            request_id=meta["request_id"],
            ip_address=meta["ip_address"],
            user_agent_summary=meta["user_agent"],
            metadata={"reason": "account_locked"},
        )
        return AuthResult(success=False, locked=True, error_code="invalid_credentials")

    if not candidate.is_active:
        record_event(
            event_type="LOGIN_FAILURE",
            subject_user=candidate,
            request_id=meta["request_id"],
            ip_address=meta["ip_address"],
            user_agent_summary=meta["user_agent"],
            metadata={"reason": "inactive"},
        )
        return AuthResult(success=False, error_code="invalid_credentials")

    locked_user = record_failed_login(candidate, request=request)
    record_event(
        event_type="LOGIN_FAILURE",
        subject_user=candidate,
        request_id=meta["request_id"],
        ip_address=meta["ip_address"],
        user_agent_summary=meta["user_agent"],
        metadata={"reason": "invalid_credentials"},
    )
    return AuthResult(
        success=False,
        locked=locked_user.is_locked,
        error_code="invalid_credentials",
    )


@atomic_fn
def record_failed_login(user: User, *, request: HttpRequest | None = None) -> User:
    """Increment failure counters with CAS; lock account at threshold."""
    from apps.security_audit.services import record_event

    # Retry loop for CAS counter increment
    for _attempt in range(5):
        locked_user = _ensure_user(
            lock_queryset(User.objects.filter(pk=user.pk)).get(),
            context="record_failed_login",
        )
        if locked_user.is_locked:
            return locked_user

        now = timezone.now()
        current_count = locked_user.failed_login_count
        new_count = current_count + 1

        # Atomic CAS increment
        updates = {
            "failed_login_count": new_count,
            "last_failed_login_at": now,
        }

        # If this increment crosses threshold, also set lockout
        if new_count >= _max_failed_attempts():
            updates["locked_until"] = now + timedelta(minutes=_lockout_minutes())

        result = conditional_update(
            User.objects.all(),
            expected={"pk": user.pk, "failed_login_count": current_count},
            updates=updates,
        )

        if result.applied:
            # CAS succeeded; re-read for audit
            locked_user = User.objects.get(pk=user.pk)
            if locked_user.locked_until is not None and locked_user.locked_until > now:
                meta = _client_meta(request)
                record_event(
                    event_type="ACCOUNT_LOCKED",
                    subject_user=locked_user,
                    request_id=meta["request_id"],
                    ip_address=meta["ip_address"],
                    user_agent_summary=meta["user_agent"],
                    metadata={"failed_login_count": locked_user.failed_login_count},
                )
            return locked_user
        # CAS conflict; retry

    # Fallback: return current state after retries exhausted
    return User.objects.get(pk=user.pk)


@atomic_fn
def record_successful_login(user: User, *, request: HttpRequest) -> User:
    """Reset failure counters, stamp success time, establish session with key cycle."""
    locked_user = _ensure_user(
        lock_queryset(User.objects.filter(pk=user.pk)).get(),
        context="record_successful_login",
    )
    now = timezone.now()
    locked_user.failed_login_count = 0
    locked_user.locked_until = None
    locked_user.last_successful_login_at = now
    locked_user.save(
        update_fields=[
            "failed_login_count",
            "locked_until",
            "last_successful_login_at",
        ]
    )
    login(request, locked_user, backend="apps.accounts.backends.EmployeeCodeBackend")
    request.session.cycle_key()
    return locked_user


def logout_user(request: HttpRequest) -> None:
    from apps.security_audit.services import record_event

    user = request.user if request.user.is_authenticated else None
    meta = _client_meta(request)
    logout(request)
    if user is not None and isinstance(user, User):
        record_event(
            event_type="LOGOUT",
            actor=user,
            subject_user=user,
            request_id=meta["request_id"],
            ip_address=meta["ip_address"],
            user_agent_summary=meta["user_agent"],
            metadata={},
        )


@transaction.atomic
def change_password(
    user: User,
    *,
    current_password: str,
    new_password: str,
    request: HttpRequest | None = None,
) -> User:
    from apps.security_audit.services import record_event

    if not user.check_password(current_password):
        raise ValidationError({"current_password": "Current password is incorrect."})

    user.set_password(new_password)
    user.must_change_password = False
    user.password_changed_at = timezone.now()
    user.save(update_fields=["password", "must_change_password", "password_changed_at"])

    meta = _client_meta(request)
    record_event(
        event_type="PASSWORD_CHANGED",
        actor=user,
        subject_user=user,
        request_id=meta["request_id"],
        ip_address=meta["ip_address"],
        user_agent_summary=meta["user_agent"],
        metadata={},
    )
    if request is not None and request.user.is_authenticated:
        login(request, user, backend="apps.accounts.backends.EmployeeCodeBackend")
        request.session.cycle_key()
    return user


@transaction.atomic
def force_password_change(
    user: User,
    *,
    new_password: str,
    request: HttpRequest | None = None,
) -> User:
    """Set a new password when must_change_password is required (no current password)."""
    from apps.security_audit.services import record_event

    user.set_password(new_password)
    user.must_change_password = False
    user.password_changed_at = timezone.now()
    user.save(update_fields=["password", "must_change_password", "password_changed_at"])

    meta = _client_meta(request)
    record_event(
        event_type="PASSWORD_CHANGED",
        actor=user,
        subject_user=user,
        request_id=meta["request_id"],
        ip_address=meta["ip_address"],
        user_agent_summary=meta["user_agent"],
        metadata={"forced": True},
    )
    if request is not None and request.user.is_authenticated:
        login(request, user, backend="apps.accounts.backends.EmployeeCodeBackend")
        request.session.cycle_key()
    return user


@transaction.atomic
def unlock_account(
    user: User,
    *,
    actor: User | None = None,
    request: HttpRequest | None = None,
) -> User:
    from apps.security_audit.services import record_event

    locked_user = _ensure_user(
        lock_queryset(User.objects.filter(pk=user.pk)).get(),
        context="unlock_user",
    )
    locked_user.failed_login_count = 0
    locked_user.locked_until = None
    locked_user.save(update_fields=["failed_login_count", "locked_until"])

    meta = _client_meta(request)
    record_event(
        event_type="ACCOUNT_UNLOCKED",
        actor=actor,
        subject_user=locked_user,
        request_id=meta["request_id"],
        ip_address=meta["ip_address"],
        user_agent_summary=meta["user_agent"],
        metadata={},
    )
    return locked_user


@transaction.atomic
def set_must_change_password(user: User, *, enabled: bool = True) -> User:
    user.must_change_password = enabled
    user.save(update_fields=["must_change_password"])
    return user


@transaction.atomic
def admin_reset_password(
    user: User,
    *,
    new_password: str,
    actor: User | None = None,
    request: HttpRequest | None = None,
) -> User:
    from apps.security_audit.services import record_event

    user.set_password(new_password)
    require_change = bool(getattr(settings, "AUTH_PASSWORD_CHANGE_REQUIRED_ON_ADMIN_RESET", True))
    user.must_change_password = require_change
    user.password_changed_at = timezone.now()
    user.failed_login_count = 0
    user.locked_until = None
    user.save(
        update_fields=[
            "password",
            "must_change_password",
            "password_changed_at",
            "failed_login_count",
            "locked_until",
        ]
    )
    meta = _client_meta(request)
    record_event(
        event_type="PASSWORD_RESET_BY_ADMIN",
        actor=actor,
        subject_user=user,
        request_id=meta["request_id"],
        ip_address=meta["ip_address"],
        user_agent_summary=meta["user_agent"],
        metadata={},
    )
    return user
