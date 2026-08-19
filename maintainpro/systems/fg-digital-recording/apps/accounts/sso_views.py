"""MaintainPro SSO consume / access-denied views."""

from __future__ import annotations

from django.contrib.auth import logout
from django.core.exceptions import PermissionDenied
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse
from django.views.decorators.http import require_GET


from apps.accounts.sso import (
    FG_SSO_ASSERTION_COOKIE,
    establish_fg_session,
    reject_forged_identity_headers,
    verify_fg_sso_assertion,
)


def _safe_next(raw: str | None) -> str:
    fallback = "/"
    value = (raw or "").strip()
    if not value.startswith("/"):
        return fallback
    if value.startswith("//") or "://" in value:
        return fallback
    # Avoid open redirect back into SSO consume loop.
    if "/sso/" in value:
        return fallback
    return value


@require_GET
def sso_consume_view(request: HttpRequest) -> HttpResponse:
    reject_forged_identity_headers(request)
    assertion = request.COOKIES.get(FG_SSO_ASSERTION_COOKIE, "")
    next_url = _safe_next(request.GET.get("next"))
    if not assertion:
        # No assertion — send through MaintainPro handoff.
        handoff = f"/api/fg-sso/handoff?next=/fg{next_url if next_url != '/' else '/'}"
        return HttpResponseRedirect(handoff)

    try:
        claims = verify_fg_sso_assertion(assertion)
        establish_fg_session(request, claims)
    except PermissionDenied:
        logout(request)
        return HttpResponseRedirect(reverse("sso_denied"))

    response = HttpResponseRedirect(next_url)
    response.delete_cookie(FG_SSO_ASSERTION_COOKIE, path="/fg")
    # Also clear without path for defensive cleanup.
    response.delete_cookie(FG_SSO_ASSERTION_COOKIE, path="/")
    return response


@require_GET
def sso_denied_view(request: HttpRequest) -> HttpResponse:
    return render(request, "accounts/sso_denied.html", status=403)
