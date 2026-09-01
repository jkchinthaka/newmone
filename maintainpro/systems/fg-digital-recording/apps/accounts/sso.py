"""MaintainPro → FG SSO assertion verification and principal projection."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured, PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.http import HttpRequest
from django.utils import timezone

from apps.core.persistence import atomic, is_mongodb

logger = logging.getLogger(__name__)
User = get_user_model()

FG_SSO_ASSERTION_COOKIE = "fg_sso_assertion"
FG_SSO_BACKEND = "apps.accounts.backends.MaintainProSsoBackend"
FG_SSO_JTI_CACHE_PREFIX = "fg_sso:jti:"
FG_SSO_PROJ_LOCK_PREFIX = "fg_sso:proj_lock:"


@dataclass(frozen=True)
class FgSsoClaims:
    sub: str
    email: str
    first_name: str
    last_name: str
    tenant_id: str
    role: str
    permissions: tuple[str, ...]
    jti: str
    exp: int
    iss: str
    aud: str


def _sso_secret() -> str:
    secret = str(getattr(settings, "FG_SSO_SIGNING_SECRET", "") or "").strip()
    if len(secret) < 32:
        raise ImproperlyConfigured(
            "FG_SSO_SIGNING_SECRET must be configured (min 32 chars) for MaintainPro SSO."
        )
    return secret


def consume_fg_sso_jti(jti: str, exp: int) -> None:
    """
    One-time assertion consume via Redis/Django cache (SETNX).
    Fail closed on cache errors. TTL exceeds assertion expiry.
    """
    token_jti = (jti or "").strip()
    if not token_jti:
        raise PermissionDenied("FG SSO assertion missing jti.")

    now = int(time.time())
    ttl_pad = int(getattr(settings, "FG_SSO_JTI_TTL_PAD_SECONDS", 300) or 300)
    timeout = max(60, (int(exp) - now) + max(60, ttl_pad))
    cache_key = f"{FG_SSO_JTI_CACHE_PREFIX}{token_jti}"
    try:
        stored = cache.add(cache_key, "1", timeout=timeout)
    except Exception as exc:  # noqa: BLE001 — fail closed on Redis/cache outage
        logger.error("fg_sso_jti_cache_unavailable")
        raise PermissionDenied("FG SSO replay store unavailable.") from exc
    if not stored:
        raise PermissionDenied("FG SSO assertion already consumed.")


def verify_fg_sso_assertion(assertion: str, *, consume_jti: bool = True) -> FgSsoClaims:
    """Fail-closed verification of MaintainPro-issued FG SSO JWT."""
    token = (assertion or "").strip()
    if not token:
        raise PermissionDenied("Missing FG SSO assertion.")

    issuer = str(getattr(settings, "FG_SSO_ISSUER", "maintainpro")).strip() or "maintainpro"
    audience = (
        str(getattr(settings, "FG_SSO_AUDIENCE", "fg-digital-recording")).strip()
        or "fg-digital-recording"
    )

    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            _sso_secret(),
            algorithms=["HS256"],
            issuer=issuer,
            audience=audience,
            options={"require": ["exp", "iat", "sub", "jti", "iss", "aud"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise PermissionDenied("FG SSO assertion expired.") from exc
    except jwt.InvalidIssuerError as exc:
        raise PermissionDenied("FG SSO assertion issuer invalid.") from exc
    except jwt.InvalidAudienceError as exc:
        raise PermissionDenied("FG SSO assertion audience invalid.") from exc
    except jwt.InvalidSignatureError as exc:
        raise PermissionDenied("FG SSO assertion signature invalid.") from exc
    except jwt.PyJWTError as exc:
        raise PermissionDenied("FG SSO assertion invalid.") from exc

    sub = str(payload.get("sub") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    jti = str(payload.get("jti") or "").strip()
    if not sub or not email:
        raise PermissionDenied("FG SSO assertion missing identity claims.")
    if not jti:
        raise PermissionDenied("FG SSO assertion missing jti.")

    permissions_raw = payload.get("permissions") or []
    if not isinstance(permissions_raw, list):
        raise PermissionDenied("FG SSO assertion permissions invalid.")
    permissions = tuple(str(p) for p in permissions_raw if isinstance(p, str) and p.strip())
    if "fg.access" not in permissions:
        raise PermissionDenied("FG access is not granted.")

    claims = FgSsoClaims(
        sub=sub,
        email=email,
        first_name=str(payload.get("firstName") or payload.get("first_name") or "").strip(),
        last_name=str(payload.get("lastName") or payload.get("last_name") or "").strip(),
        tenant_id=str(payload.get("tenantId") or payload.get("tenant_id") or "").strip(),
        role=str(payload.get("role") or "").strip(),
        permissions=permissions,
        jti=jti,
        exp=int(payload["exp"]),
        iss=str(payload.get("iss") or ""),
        aud=str(payload.get("aud") or ""),
    )
    if consume_jti:
        consume_fg_sso_jti(claims.jti, claims.exp)
    return claims


def project_maintainpro_principal(claims: FgSsoClaims) -> Any:
    """
    JIT upsert a local Django principal with unusable password.

    Concurrent first-login for the same MaintainPro id is serialized via Redis/cache
    lock and recovered on IntegrityError/ValidationError so exactly one principal
    survives on both PostgreSQL and Mongo.
    """

    def _apply_identity(user: Any, *, created: bool) -> Any:
        user.email = claims.email
        user.maintainpro_email = claims.email
        user.first_name = claims.first_name[:150]
        user.last_name = claims.last_name[:150]
        user.is_active = True
        user.must_change_password = False
        user.locked_until = None
        user.failed_login_count = 0
        user.maintainpro_synced_at = timezone.now()
        user.is_staff = "fg.admin" in claims.permissions
        if "fg.admin" not in claims.permissions:
            user.is_superuser = False
        user.set_unusable_password()
        try:
            user.full_clean()
        except ValidationError as exc:
            winner = User.objects.filter(maintainpro_user_id=claims.sub).first()
            if (
                winner is not None
                and winner.pk != getattr(user, "pk", None)
                and created
            ):
                return _apply_identity(winner, created=False)
            raise PermissionDenied("Unable to project MaintainPro principal.") from exc
        try:
            with atomic():
                user.save()
        except (IntegrityError, ValidationError) as exc:
            winner = User.objects.filter(maintainpro_user_id=claims.sub).first()
            if (
                winner is not None
                and winner.pk != getattr(user, "pk", None)
                and created
            ):
                return _apply_identity(winner, created=False)
            raise PermissionDenied("Unable to project MaintainPro principal.") from exc
        logger.info(
            "fg_sso_principal_%s maintainpro_user_id=%s",
            "created" if created else "updated",
            claims.sub,
        )
        return user

    existing = User.objects.filter(maintainpro_user_id=claims.sub).first()
    if existing is not None:
        return _apply_identity(existing, created=False)

    lock_key = f"{FG_SSO_PROJ_LOCK_PREFIX}{claims.sub}"
    got_lock = False
    try:
        try:
            got_lock = bool(cache.add(lock_key, "1", timeout=30))
        except Exception as exc:  # noqa: BLE001 — same Redis as jti; fail closed
            logger.error("fg_sso_proj_lock_unavailable")
            raise PermissionDenied("FG principal lock store unavailable.") from exc

        if not got_lock:
            for _ in range(40):
                time.sleep(0.05)
                winner = User.objects.filter(maintainpro_user_id=claims.sub).first()
                if winner is not None:
                    return _apply_identity(winner, created=False)
            raise PermissionDenied("Unable to project MaintainPro principal (contention).")

        existing = User.objects.filter(maintainpro_user_id=claims.sub).first()
        if existing is not None:
            return _apply_identity(existing, created=False)

        username = f"mp_{claims.sub}"[:150]
        if User.objects.filter(username=username).exists():
            username = f"mp_{claims.sub}_{claims.jti[:8]}"[:150]
        user = User(
            username=username,
            email=claims.email,
            maintainpro_user_id=claims.sub,
            employee_code=None,
            is_active=True,
            must_change_password=False,
        )
        if not is_mongodb():
            with transaction.atomic():
                again = (
                    User.objects.select_for_update()
                    .filter(maintainpro_user_id=claims.sub)
                    .first()
                )
                if again is not None:
                    return _apply_identity(again, created=False)
                return _apply_identity(user, created=True)
        return _apply_identity(user, created=True)
    finally:
        if got_lock:
            try:
                cache.delete(lock_key)
            except Exception:  # noqa: BLE001
                logger.warning("fg_sso_proj_lock_release_failed")


def establish_fg_session(request: HttpRequest, claims: FgSsoClaims) -> Any:
    user = project_maintainpro_principal(claims)
    login(request, user, backend=FG_SSO_BACKEND)
    request.session.cycle_key()
    request.session["maintainpro_user_id"] = claims.sub
    request.session["maintainpro_permissions"] = list(claims.permissions)
    request.session["maintainpro_role"] = claims.role
    request.session["maintainpro_tenant_id"] = claims.tenant_id
    request.session["fg_sso_jti"] = claims.jti
    request.session["fg_sso_exp"] = claims.exp
    request.session["fg_sso_authenticated_at"] = datetime.now(tz=UTC).isoformat()
    request.session["mp_revalidated_at"] = int(time.time())

    # Deterministically reconcile the FG org-scoped Recorder ScopedRoleAssignment from
    # the MaintainPro fg.* claims on every login. Best-effort: provisioning must never
    # block an otherwise-valid SSO session (see maintainpro_provisioning docstring).
    from apps.access_control.maintainpro_provisioning import reconcile_recorder_scope

    reconcile_recorder_scope(user, tenant_id=claims.tenant_id, permissions=claims.permissions)

    return user


def reject_forged_identity_headers(request: HttpRequest) -> None:
    """Identity must never come from browser-supplied x-user-* headers."""
    forbidden = (
        "HTTP_X_USER_ID",
        "HTTP_X_ROLE",
        "HTTP_X_EMAIL",
        "HTTP_X_PERMISSIONS",
        "HTTP_X_MAINTAINPRO_USER_ID",
    )
    for key in forbidden:
        if request.META.get(key):
            raise PermissionDenied("Forged identity headers are rejected.")


def verify_maintainpro_access_token(access_token: str) -> dict[str, Any]:
    """Validate MaintainPro access JWT (signature/exp). Fail closed."""
    secret = str(
        getattr(settings, "MAINTAINPRO_JWT_ACCESS_SECRET", "")
        or getattr(settings, "JWT_ACCESS_SECRET", "")
        or ""
    ).strip()
    if len(secret) < 16:
        raise PermissionDenied("MaintainPro access token validation is not configured.")
    try:
        return jwt.decode(
            access_token,
            secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise PermissionDenied("MaintainPro access token is invalid or expired.") from exc


def live_revalidate_maintainpro_user(access_token: str) -> None:
    """
    Authoritative live check against Nest /auth/me (active/locked enforced by JwtStrategy).
    Fail closed on network/HTTP errors when required.
    """
    import urllib.error
    import urllib.request

    base = str(getattr(settings, "MAINTAINPRO_API_INTERNAL_URL", "") or "").strip().rstrip("/")
    if not base:
        if getattr(settings, "MAINTAINPRO_SSO_REQUIRE_LIVE_REVALIDATION", False):
            raise PermissionDenied("MaintainPro live revalidation is not configured.")
        return

    url = f"{base}/auth/me"
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
    )
    timeout = float(getattr(settings, "MAINTAINPRO_SSO_REVALIDATE_TIMEOUT_SECONDS", 3) or 3)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 — internal URL
            if getattr(resp, "status", 200) >= 400:
                raise PermissionDenied("MaintainPro session is no longer valid.")
    except PermissionDenied:
        raise
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
        raise PermissionDenied("MaintainPro session revalidation failed.") from exc
