"""Account authentication views — no FG business workflows."""

from __future__ import annotations

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts import services as account_services
from apps.accounts.forms import ChangePasswordForm, ForcePasswordChangeForm, LoginForm
from apps.accounts.services import GENERIC_LOGIN_ERROR


def _safe_post_login_redirect(request: HttpRequest) -> str | None:
    """Return a same-origin path for post-login resume, or None."""
    candidates: list[str] = []
    next_raw = request.GET.get("next") or request.POST.get("next")
    if next_raw:
        candidates.append(str(next_raw))
    resume = request.session.get("recording_resume_url")
    if resume:
        candidates.append(str(resume))
    for candidate in candidates:
        if url_has_allowed_host_and_scheme(
            url=candidate,
            allowed_hosts={request.get_host()},
            require_https=request.is_secure(),
        ):
            return candidate
    return None


@require_http_methods(["GET", "POST"])
def login_view(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("accounts:landing")

    form = LoginForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        result = account_services.authenticate_login(
            request,
            employee_code=form.cleaned_data["employee_code"],
            password=form.cleaned_data["password"],
        )
        if result.success and result.user is not None:
            if result.user.must_change_password:
                return redirect("accounts:force_password_change")
            resume = _safe_post_login_redirect(request)
            if resume:
                request.session.pop("recording_resume_url", None)
                return redirect(resume)
            return redirect(login_redirect_target(result.user))
        # All denial outcomes share the same status, template, and message.
        form.add_error(None, GENERIC_LOGIN_ERROR)

    return render(request, "accounts/login.html", {"form": form})


@require_POST
@login_required
def logout_view(request: HttpRequest) -> HttpResponse:
    account_services.logout_user(request)
    messages.info(request, "You have been signed out.")
    return redirect("accounts:login")


@require_http_methods(["GET", "POST"])
@login_required
def change_password_view(request: HttpRequest) -> HttpResponse:
    form = ChangePasswordForm(request.user, request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            account_services.change_password(
                request.user,  # type: ignore[arg-type]
                current_password=form.cleaned_data["current_password"],
                new_password=form.cleaned_data["new_password"],
                request=request,
            )
        except ValidationError as exc:
            if hasattr(exc, "message_dict"):
                for field, errors in exc.message_dict.items():
                    for error in errors:
                        form.add_error(field if field in form.fields else None, error)
            else:
                form.add_error(None, exc.message)
        else:
            messages.success(request, "Password updated.")
            return redirect("accounts:landing")

    return render(request, "accounts/change_password.html", {"form": form})


@require_http_methods(["GET", "POST"])
@login_required
def force_password_change_view(request: HttpRequest) -> HttpResponse:
    user = request.user
    if not getattr(user, "must_change_password", False):
        return redirect("accounts:landing")

    form = ForcePasswordChangeForm(user, request.POST or None)
    if request.method == "POST" and form.is_valid():
        account_services.force_password_change(
            user,  # type: ignore[arg-type]
            new_password=form.cleaned_data["new_password"],
            request=request,
        )
        messages.success(request, "Password updated. You may continue.")
        return redirect("accounts:landing")

    return render(request, "accounts/force_password_change.html", {"form": form})


@require_GET
def account_locked_view(request: HttpRequest) -> HttpResponse:
    """
    Informational page only.

    Login never redirects here based on a submitted employee code. Keeping the
    route avoids breaking bookmarks while preventing account-existence leaks.
    """
    return render(request, "accounts/account_locked.html")


@require_GET
@login_required
def landing_view(request: HttpRequest) -> HttpResponse:
    from apps.accounts.dashboard import landing_dashboard_cards

    user = request.user
    cards = landing_dashboard_cards(user)
    return render(
        request,
        "accounts/landing.html",
        {
            "dashboard_cards": cards,
            "page_title": "Dashboard",
            "breadcrumbs": [{"label": "Dashboard"}],
        },
    )


def login_redirect_target(user: object) -> str:
    if getattr(user, "must_change_password", False):
        return reverse("accounts:force_password_change")
    return reverse("accounts:landing")
