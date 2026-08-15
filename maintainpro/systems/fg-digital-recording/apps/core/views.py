"""Foundation views — no business workflows."""

from __future__ import annotations

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET


@require_GET
def home(request: HttpRequest) -> HttpResponse:
    """Project foundation status page with safe non-secret information only."""
    if request.user.is_authenticated:
        from django.shortcuts import redirect

        return redirect("accounts:landing")

    return render(
        request,
        "pages/home.html",
        {
            "project_name": "Nelna FG Digital Recording System",
            "environment_label": getattr(settings, "ENVIRONMENT_LABEL", "unspecified"),
            "app_version": getattr(settings, "APP_VERSION", "unknown"),
            "foundation_status": "Signed-out entry page",
        },
    )


@require_GET
def htmx_status_partial(request: HttpRequest) -> HttpResponse:
    """Small non-business HTMX partial to validate HTMX + CSRF configuration."""
    return render(
        request,
        "components/loading_state.html",
        {
            "message": "HTMX foundation response received.",
            "show_spinner": False,
        },
    )


def bad_request(request: HttpRequest, exception: Exception | None = None) -> HttpResponse:
    return render(request, "errors/400.html", status=400)


def permission_denied(request: HttpRequest, exception: Exception | None = None) -> HttpResponse:
    return render(request, "errors/403.html", status=403)


def page_not_found(request: HttpRequest, exception: Exception | None = None) -> HttpResponse:
    return render(request, "errors/404.html", status=404)


def server_error(request: HttpRequest) -> HttpResponse:
    return render(request, "errors/500.html", status=500)
