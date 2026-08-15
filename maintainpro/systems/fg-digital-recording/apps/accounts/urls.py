"""Accounts URL routes."""

from __future__ import annotations

from django.urls import path

from apps.accounts import views

app_name = "accounts"

urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("change-password/", views.change_password_view, name="change_password"),
    path(
        "force-change-password/",
        views.force_password_change_view,
        name="force_password_change",
    ),
    path("locked/", views.account_locked_view, name="account_locked"),
    path("landing/", views.landing_view, name="landing"),
]
