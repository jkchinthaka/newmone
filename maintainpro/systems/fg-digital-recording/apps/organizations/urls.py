"""Organization and Shift management URLs."""

from __future__ import annotations

from django.urls import path

from apps.organizations import views

app_name = "organizations"

urlpatterns = [
    path("shifts/", views.shift_list, name="shift_list"),
    path("shifts/new/", views.shift_create, name="shift_create"),
    path("shifts/options/sites/", views.shift_sites_options, name="shift_sites_options"),
    path(
        "shifts/options/departments/",
        views.shift_departments_options,
        name="shift_departments_options",
    ),
    path("shifts/<uuid:shift_id>/", views.shift_detail, name="shift_detail"),
    path("shifts/<uuid:shift_id>/edit/", views.shift_edit, name="shift_edit"),
    path("shifts/<uuid:shift_id>/activate/", views.shift_activate, name="shift_activate"),
    path(
        "shifts/<uuid:shift_id>/deactivate/",
        views.shift_deactivate,
        name="shift_deactivate",
    ),
]
