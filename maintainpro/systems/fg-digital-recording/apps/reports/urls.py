"""URL routes for governed quality reports."""

from __future__ import annotations

from django.urls import path

from apps.reports import views

app_name = "reports"

urlpatterns = [
    path("reports/", views.report_catalogue, name="catalogue"),
    path("reports/trends/", views.quality_trends, name="trends"),
    path("reports/run/", views.report_run_create, name="run_create"),
    path("reports/runs/<uuid:report_run_id>/", views.report_run_detail, name="run_detail"),
    path(
        "reports/runs/<uuid:report_run_id>/export.csv",
        views.report_run_export_csv,
        name="run_export_csv",
    ),
]
