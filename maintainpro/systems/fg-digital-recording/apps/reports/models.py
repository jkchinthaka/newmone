"""Governed report run models — Phase 16 foundation."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.organizations.models import Organization
from apps.reports.catalogue import ReportCode


class ReportRunStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    RUNNING = "RUNNING", "Running"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class ReportExportFormat(models.TextChoices):
    CSV = "CSV", "CSV"
    # Excel/PDF reserved — not implemented without approved libraries / owner need.


class ReportRun(models.Model):
    """
    One governed report execution (sync or background).

    Result CSV is stored for completed runs. Soft retention — no hard delete via admin.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="report_runs",
    )
    report_code = models.CharField(
        max_length=64,
        choices=[(c.value, c.value) for c in ReportCode],
    )
    export_format = models.CharField(
        max_length=8,
        choices=ReportExportFormat.choices,
        default=ReportExportFormat.CSV,
    )
    status = models.CharField(
        max_length=16,
        choices=ReportRunStatus.choices,
        default=ReportRunStatus.PENDING,
    )
    filters = models.JSONField(default=dict, blank=True)
    row_count = models.PositiveIntegerField(default=0)
    result_csv = models.TextField(blank=True, default="")
    error_summary = models.CharField(max_length=255, blank=True, default="")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="report_runs_requested",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Report run"
        verbose_name_plural = "Report runs"
        permissions = [
            ("run_qualityreport", "Can run governed quality reports"),
            ("export_qualityreport", "Can export governed quality reports"),
            ("view_reportcatalogue", "Can view quality report catalogue"),
        ]
        indexes = [
            models.Index(
                fields=["organization", "report_code", "created_at"],
                name="reports_org_code_at_idx",
            ),
            models.Index(
                fields=["organization", "status"],
                name="reports_org_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.report_code} / {self.status} / {self.id}"
