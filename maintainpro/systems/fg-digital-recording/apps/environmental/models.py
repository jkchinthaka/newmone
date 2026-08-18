"""Environmental monitoring foundation — Phase 28.

Generic monitoring points, versioned limit shells, and readings from
MANUAL / LAB / SENSOR sources. Does not invent Nelna parameters, limits,
frequencies, or auto-HOLD stock policy.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Department, Organization, Site


class MonitoringParameterCategory(models.TextChoices):
    """Optional taxonomy — blank allowed; do not assume Nelna uses every value."""

    TEMPERATURE = "TEMPERATURE", "Temperature"
    HUMIDITY = "HUMIDITY", "Humidity"
    WATER = "WATER", "Water test"
    SWAB = "SWAB", "Surface / environment swab"
    OTHER = "OTHER", "Other approved measurement"


class MonitoringSpecVersionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    RETIRED = "RETIRED", "Retired"


class MonitoringSourceType(models.TextChoices):
    MANUAL = "MANUAL", "Manual entry"
    LAB = "LAB", "Laboratory result link"
    SENSOR = "SENSOR", "Sensor / IoT placeholder"


class MonitoringEvaluationOutcome(models.TextChoices):
    """Limit evaluation outcome — not a QA RELEASE/HOLD/REJECT disposition."""

    IN_RANGE = "IN_RANGE", "In range"
    WARN = "WARN", "Warning band"
    EXCURSION = "EXCURSION", "Excursion (outside configured limits)"
    NOT_EVALUATED = "NOT_EVALUATED", "Not evaluated (limits pending)"


class MonitoringPoint(models.Model):
    """Reusable monitoring location reference."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="monitoring_points",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="monitoring_points",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="monitoring_points",
    )
    room_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Opaque room label — Room master EVIDENCE REQUIRED.",
    )
    line_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Opaque line label — Line master EVIDENCE REQUIRED.",
    )
    work_area_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Opaque work-area label — Area master EVIDENCE REQUIRED.",
    )
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="monitoring_points_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Monitoring point"
        verbose_name_plural = "Monitoring points"
        permissions = [
            ("manage_environmental", "Can manage environmental monitoring configuration"),
            ("record_environmentalreading", "Can record environmental monitoring readings"),
            ("view_environmental", "Can view environmental monitoring (read-only)"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="em_monitoring_point_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        site = self.site
        if site is not None and self.organization_id:
            if site.organization_id != self.organization_id:
                raise ValidationError({"site": "Site must belong to the same organization."})
        department = self.department
        if department is not None and self.organization_id:
            if department.organization_id != self.organization_id:
                raise ValidationError(
                    {"department": "Department must belong to the same organization."}
                )


class MonitoringParameter(models.Model):
    """Company-configured parameter shell — not a seeded Nelna catalogue."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="monitoring_parameters",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=32, blank=True, default="")
    category = models.CharField(
        max_length=32,
        blank=True,
        default="",
        choices=MonitoringParameterCategory.choices,
        help_text="Optional family label only — blank until company catalogue exists.",
    )
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="monitoring_parameters_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Monitoring parameter"
        verbose_name_plural = "Monitoring parameters"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="em_monitoring_parameter_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class MonitoringSpec(models.Model):
    """Stable identity for a versioned environmental limit specification."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="monitoring_specs",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="monitoring_specs_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Monitoring specification"
        verbose_name_plural = "Monitoring specifications"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="em_monitoring_spec_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class MonitoringSpecVersion(models.Model):
    """Immutable after APPROVED/RETIRED — historical readings PROTECT this row."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spec = models.ForeignKey(
        MonitoringSpec,
        on_delete=models.PROTECT,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=MonitoringSpecVersionStatus.choices,
        default=MonitoringSpecVersionStatus.DRAFT,
    )
    change_summary = models.TextField(blank=True, default="")
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="monitoring_spec_versions_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="monitoring_spec_versions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("spec__code", "-version_number")
        verbose_name = "Monitoring specification version"
        verbose_name_plural = "Monitoring specification versions"
        constraints = [
            models.UniqueConstraint(
                fields=["spec", "version_number"],
                name="em_monitoring_spec_version_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.spec.code} v{self.version_number} ({self.status})"

    @property
    def is_immutable(self) -> bool:
        return self.status in {
            MonitoringSpecVersionStatus.APPROVED,
            MonitoringSpecVersionStatus.RETIRED,
        }


class MonitoringLimitRule(models.Model):
    """
    Limit shell for one parameter at one monitoring point on a spec version.

    min/max remain null until company evidence supplies values — never invent.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spec_version = models.ForeignKey(
        MonitoringSpecVersion,
        on_delete=models.CASCADE,
        related_name="limit_rules",
    )
    monitoring_point = models.ForeignKey(
        MonitoringPoint,
        on_delete=models.PROTECT,
        related_name="limit_rules",
    )
    parameter = models.ForeignKey(
        MonitoringParameter,
        on_delete=models.PROTECT,
        related_name="limit_rules",
    )
    bound_min = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    bound_max = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    warn_min = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    warn_max = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("parameter__code", "monitoring_point__code")
        verbose_name = "Monitoring limit rule"
        verbose_name_plural = "Monitoring limit rules"
        constraints = [
            models.UniqueConstraint(
                fields=["spec_version", "monitoring_point", "parameter"],
                name="em_limit_rule_version_point_param_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.parameter.code}@{self.monitoring_point.code}"

    def clean(self) -> None:
        super().clean()
        org_id = self.spec_version.spec.organization_id if self.spec_version_id else None
        if org_id is None:
            return
        monitoring_point = self.monitoring_point

        if (
            self.monitoring_point_id
            and monitoring_point is not None
            and monitoring_point.organization_id != org_id
        ):
            raise ValidationError(
                {"monitoring_point": "Point must belong to the same organization."}
            )
        parameter = self.parameter

        if self.parameter_id and parameter is not None and parameter.organization_id != org_id:
            raise ValidationError({"parameter": "Parameter must belong to the same organization."})
        if (
            self.bound_min is not None
            and self.bound_max is not None
            and self.bound_min > self.bound_max
        ):
            raise ValidationError({"bound_max": "bound_max cannot be less than bound_min."})


class MonitoringScheduleLink(models.Model):
    """Optional link from a monitoring point/parameter to a ChecklistSchedule."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="monitoring_schedule_links",
    )
    monitoring_point = models.ForeignKey(
        MonitoringPoint,
        on_delete=models.PROTECT,
        related_name="schedule_links",
    )
    parameter = models.ForeignKey(
        MonitoringParameter,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="schedule_links",
    )
    checklist_schedule = models.ForeignKey(
        "scheduling.ChecklistSchedule",
        on_delete=models.PROTECT,
        related_name="environmental_links",
        help_text="Recurring readings use the existing scheduler — frequencies EVIDENCE REQUIRED.",
    )
    label = models.CharField(max_length=128, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("monitoring_point__code", "label")
        verbose_name = "Monitoring schedule link"
        verbose_name_plural = "Monitoring schedule links"

    def __str__(self) -> str:
        return f"{self.monitoring_point_id}:{self.checklist_schedule_id}"

    def clean(self) -> None:
        super().clean()
        checklist_schedule = self.checklist_schedule
        if checklist_schedule is not None and self.organization_id:
            if checklist_schedule.organization_id != self.organization_id:
                raise ValidationError(
                    {"checklist_schedule": "Schedule must belong to the same organization."}
                )
        monitoring_point = self.monitoring_point
        if monitoring_point is not None and self.organization_id:
            if monitoring_point.organization_id != self.organization_id:
                raise ValidationError(
                    {"monitoring_point": "Point must belong to the same organization."}
                )


class MonitoringReading(models.Model):
    """Immutable operational reading once created (soft retention — no hard delete)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="monitoring_readings",
    )
    monitoring_point = models.ForeignKey(
        MonitoringPoint,
        on_delete=models.PROTECT,
        related_name="readings",
    )
    parameter = models.ForeignKey(
        MonitoringParameter,
        on_delete=models.PROTECT,
        related_name="readings",
    )
    source_type = models.CharField(max_length=16, choices=MonitoringSourceType.choices)
    numeric_value = models.DecimalField(max_digits=18, decimal_places=6)
    recorded_at = models.DateTimeField()
    unit = models.CharField(max_length=32, blank=True, default="")
    equipment = models.ForeignKey(
        "instruments.Equipment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="environmental_readings",
        help_text="Optional measuring device for MANUAL/SENSOR traceability.",
    )
    lab_result = models.ForeignKey(
        "laboratory.LabResult",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="environmental_readings",
        help_text="Optional laboratory result provenance for LAB source.",
    )
    sensor_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque sensor/device id placeholder — IoT not required.",
    )
    spec_version = models.ForeignKey(
        MonitoringSpecVersion,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="readings",
        help_text="Approved spec version used for evaluation (historical identity).",
    )
    device_trace_context = models.JSONField(
        default=dict,
        blank=True,
        help_text="Frozen equipment identity at reading time when equipment linked.",
    )
    notes = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="monitoring_readings_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-recorded_at", "-created_at")
        verbose_name = "Monitoring reading"
        verbose_name_plural = "Monitoring readings"
        indexes = [
            models.Index(
                fields=["organization", "monitoring_point", "parameter", "-recorded_at"],
                name="em_reading_trend_idx",
            ),
            models.Index(
                fields=["organization", "parameter", "-recorded_at"],
                name="em_reading_param_time_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.parameter.code}={self.numeric_value}@{self.recorded_at}"


class MonitoringExcursion(models.Model):
    """Excursion / warning event from limit evaluation — advisory unless policy enables HOLD."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="monitoring_excursions",
    )
    reading = models.OneToOneField(
        MonitoringReading,
        on_delete=models.PROTECT,
        related_name="excursion",
    )
    outcome = models.CharField(max_length=16, choices=MonitoringEvaluationOutcome.choices)
    limit_rule = models.ForeignKey(
        MonitoringLimitRule,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="excursions",
    )
    frozen_limit_context = models.JSONField(default=dict, blank=True)
    message = models.CharField(max_length=255, blank=True, default="")
    hold_recommended = models.BooleanField(default=False)
    auto_hold_created = models.BooleanField(
        default=False,
        help_text="True only when dual-gate policy actually created a HoldCase.",
    )
    hold_case = models.ForeignKey(
        "nonconformance.HoldCase",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="environmental_excursions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Monitoring excursion"
        verbose_name_plural = "Monitoring excursions"

    def __str__(self) -> str:
        return f"{self.outcome}/{self.reading_id}"


class MonitoringTrendIndex(models.Model):
    """Denormalized trend row for later reporting — mirrors reading identity."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="monitoring_trend_indexes",
    )
    reading = models.OneToOneField(
        MonitoringReading,
        on_delete=models.CASCADE,
        related_name="trend_index",
    )
    monitoring_point = models.ForeignKey(
        MonitoringPoint,
        on_delete=models.PROTECT,
        related_name="trend_indexes",
    )
    parameter = models.ForeignKey(
        MonitoringParameter,
        on_delete=models.PROTECT,
        related_name="trend_indexes",
    )
    source_type = models.CharField(max_length=16, choices=MonitoringSourceType.choices)
    numeric_value = models.DecimalField(max_digits=18, decimal_places=6)
    recorded_at = models.DateTimeField()
    evaluation_outcome = models.CharField(
        max_length=16,
        choices=MonitoringEvaluationOutcome.choices,
        blank=True,
        default="",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-recorded_at",)
        verbose_name = "Monitoring trend index"
        verbose_name_plural = "Monitoring trend indexes"
        indexes = [
            models.Index(
                fields=["organization", "parameter", "-recorded_at"],
                name="em_trend_param_time_idx",
            ),
            models.Index(
                fields=["organization", "monitoring_point", "-recorded_at"],
                name="em_trend_point_time_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"trend/{self.reading_id}"


class EnvironmentalExcursionPolicy(models.Model):
    """
    Org stub for excursion → auto-HOLD.

    Default OFF. Runtime also requires ENVIRONMENTAL_AUTO_HOLD_APPROVED (APR-054).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name="environmental_excursion_policy",
    )
    auto_hold_enabled = models.BooleanField(default=False)
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="environmental_excursion_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Environmental excursion policy"
        verbose_name_plural = "Environmental excursion policies"

    def __str__(self) -> str:
        return f"em-hold/{self.organization.code}"


class EnvironmentalHistoryEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="environmental_history_entries",
    )
    event_type = models.CharField(max_length=64)
    note = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="environmental_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Environmental history entry"
        verbose_name_plural = "Environmental history entries"

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at}"
