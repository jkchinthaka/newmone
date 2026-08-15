"""Laboratory / LIMS foundation models — Phase 22.

Generic sample/test/result structures for linking laboratory work to FG quality
workflows. No Nelna test catalogue, method library, incubation times, limits,
or positive-release blocking are invented or enabled by default.

Persistence: PostgreSQL SoR (ADR-002). MongoDB remains POC-only (APR-020 PENDING).
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization, Site


class LabSampleStatus(models.TextChoices):
    """Sample handling lifecycle — technical proposal, not a Nelna SOP."""

    REGISTERED = "REGISTERED", "Registered"
    RECEIVED = "RECEIVED", "Received"
    IN_TESTING = "IN_TESTING", "In testing"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


LAB_SAMPLE_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    LabSampleStatus.REGISTERED: frozenset({LabSampleStatus.RECEIVED, LabSampleStatus.CANCELLED}),
    LabSampleStatus.RECEIVED: frozenset({LabSampleStatus.IN_TESTING, LabSampleStatus.CANCELLED}),
    LabSampleStatus.IN_TESTING: frozenset({LabSampleStatus.COMPLETED, LabSampleStatus.CANCELLED}),
    LabSampleStatus.COMPLETED: frozenset(),
    LabSampleStatus.CANCELLED: frozenset(),
}


class LabResultStatus(models.TextChoices):
    """Result lifecycle — finalized rows are immutable except via amendment."""

    ENTERED = "ENTERED", "Result entered"
    VERIFIED = "VERIFIED", "Verified"
    FINALIZED = "FINALIZED", "Finalized"
    SUPERSEDED = "SUPERSEDED", "Superseded by amendment"
    CANCELLED = "CANCELLED", "Cancelled"


class LabResultType(models.TextChoices):
    NUMERIC = "NUMERIC", "Numeric"
    TEXT = "TEXT", "Text"
    SELECT = "SELECT", "Select / qualitative"


class LabResultVerificationStatus(models.TextChoices):
    """External certificate / report verification — not disposition."""

    PENDING = "PENDING", "Pending verification"
    VERIFIED = "VERIFIED", "Verified"
    REJECTED = "REJECTED", "Rejected"


class TestMethodReference(models.Model):
    """
    Opaque method/reference catalogue entry.

    Codes and titles are free-form placeholders — no seeded Nelna methods.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="lab_test_method_references",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Test method reference"
        verbose_name_plural = "Test method references"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="lab_method_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class LabTestParameter(models.Model):
    """
    Generic parameter definition (org-scoped).

    Bound fields are optional placeholders for *approved* limits only.
    Empty bounds mean EVIDENCE REQUIRED — never invent Nelna limits.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="lab_test_parameters",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    result_type = models.CharField(
        max_length=16,
        choices=LabResultType.choices,
        default=LabResultType.NUMERIC,
    )
    unit = models.CharField(max_length=64, blank=True, default="")
    select_options = models.JSONField(
        default=list,
        blank=True,
        help_text="Optional qualitative choices when result_type=SELECT. Empty until approved.",
    )
    # Optional approved bounds — null until company evidence supplies values.
    bound_min = models.DecimalField(max_digits=26, decimal_places=12, null=True, blank=True)
    bound_max = models.DecimalField(max_digits=26, decimal_places=12, null=True, blank=True)
    specification_parameter = models.ForeignKey(
        "master_data.SpecificationParameter",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_test_parameters",
        help_text="Optional link to an approved product-spec parameter (no invented limits).",
    )
    method_reference = models.ForeignKey(
        TestMethodReference,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="parameters",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Lab test parameter"
        verbose_name_plural = "Lab test parameters"
        permissions = [
            ("manage_laboratory", "Can administer laboratory catalogue and policy"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="lab_param_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        errors: dict[str, str] = {}
        if (
            self.bound_min is not None
            and self.bound_max is not None
            and self.bound_min > self.bound_max
        ):
            errors["bound_max"] = "bound_max cannot be less than bound_min."
        if self.specification_parameter_id and self.organization_id:
            specification_parameter = self.specification_parameter
            if specification_parameter is not None:
                spec_org = specification_parameter.version.specification.organization_id
                if spec_org != self.organization_id:
                    errors["specification_parameter"] = (
                        "Specification parameter must belong to the same organization."
                    )
        if errors:
            raise ValidationError(errors)


class LabSample(models.Model):
    """
    Organization-scoped laboratory sample with optional FG provenance links.

    Provenance FKs/references preserve source identity; none are invented.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="lab_samples",
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_samples",
    )
    code = models.CharField(max_length=64)
    status = models.CharField(
        max_length=16,
        choices=LabSampleStatus.choices,
        default=LabSampleStatus.REGISTERED,
    )
    product = models.ForeignKey(
        "master_data.FGProduct",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_samples",
    )
    batch_reference = models.CharField(max_length=128, blank=True, default="")
    sub_lot_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque sub-lot / quantity reference — no disposition rules invented.",
    )
    checklist_submission = models.ForeignKey(
        "recording.ChecklistSubmission",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_samples",
    )
    nonconformance = models.ForeignKey(
        "nonconformance.NonConformanceRecord",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_samples",
    )
    hold_case = models.ForeignKey(
        "nonconformance.HoldCase",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_samples",
    )
    provenance_note = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Short provenance label only — avoid sensitive free-text.",
    )
    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="lab_samples_registered",
    )
    registered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-registered_at",)
        verbose_name = "Lab sample"
        verbose_name_plural = "Lab samples"
        permissions = [
            ("register_labsample", "Can register laboratory samples"),
            ("view_laboratory", "Can view laboratory samples and results"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="lab_sample_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="lab_sample_org_status_idx",
            ),
            models.Index(
                fields=["organization", "batch_reference"],
                name="lab_sample_org_batch_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class LabTest(models.Model):
    """A laboratory test ordered or performed against a sample."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="lab_tests",
    )
    sample = models.ForeignKey(
        LabSample,
        on_delete=models.PROTECT,
        related_name="tests",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255, blank=True, default="")
    method_reference = models.ForeignKey(
        TestMethodReference,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="tests",
    )
    external_lab_code = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque external laboratory identifier — no vendor catalogue invented.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("sample__code", "code")
        verbose_name = "Lab test"
        verbose_name_plural = "Lab tests"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "sample",
                name="lab_test_sample_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.sample.code}/{self.code}"


class LabResult(models.Model):
    """
    One parameter result revision for a lab test.

    FINALIZED rows must not be silently overwritten. Corrections create a new
    revision linked via previous_result with reason/actor/timestamp.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="lab_results",
    )
    lab_test = models.ForeignKey(
        LabTest,
        on_delete=models.PROTECT,
        related_name="results",
    )
    parameter = models.ForeignKey(
        LabTestParameter,
        on_delete=models.PROTECT,
        related_name="results",
    )
    revision_number = models.PositiveIntegerField(default=1)
    previous_result = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="amendments",
    )
    status = models.CharField(
        max_length=16,
        choices=LabResultStatus.choices,
        default=LabResultStatus.ENTERED,
    )
    result_type = models.CharField(max_length=16, choices=LabResultType.choices)
    numeric_value = models.DecimalField(max_digits=26, decimal_places=12, null=True, blank=True)
    text_value = models.CharField(max_length=512, blank=True, default="")
    select_value = models.CharField(max_length=128, blank=True, default="")
    unit = models.CharField(max_length=64, blank=True, default="")
    # Snapshot of optional approved bounds at entry time (may both be null).
    bound_min = models.DecimalField(max_digits=26, decimal_places=12, null=True, blank=True)
    bound_max = models.DecimalField(max_digits=26, decimal_places=12, null=True, blank=True)
    specification_parameter = models.ForeignKey(
        "master_data.SpecificationParameter",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_results",
    )
    amendment_reason = models.CharField(max_length=512, blank=True, default="")
    entered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="lab_results_entered",
    )
    entered_at = models.DateTimeField(auto_now_add=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_results_verified",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    finalized_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_results_finalized",
    )
    finalized_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("lab_test_id", "parameter__code", "-revision_number")
        verbose_name = "Lab result"
        verbose_name_plural = "Lab results"
        permissions = [
            ("enter_labresult", "Can enter laboratory results"),
            ("verify_labresult", "Can verify laboratory results"),
            ("finalize_labresult", "Can finalize laboratory results"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["lab_test", "parameter", "revision_number"],
                name="lab_result_test_param_rev_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="lab_result_org_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.lab_test.code}/{self.parameter.code}/r{self.revision_number}"

    @property
    def is_immutable(self) -> bool:
        return self.status == LabResultStatus.FINALIZED


class LabExternalCertificate(models.Model):
    """
    External laboratory certificate / report metadata.

    Vendor names are free-form opaque references — no invented lab vendors.
    Binary files attach via evidence module (LAB_EXTERNAL_CERTIFICATE linked kind).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="lab_external_certificates",
    )
    sample = models.ForeignKey(
        LabSample,
        on_delete=models.PROTECT,
        related_name="external_certificates",
    )
    lab_test = models.ForeignKey(
        LabTest,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="external_certificates",
    )
    external_lab_reference = models.CharField(max_length=128)
    certificate_reference = models.CharField(max_length=128, blank=True, default="")
    result_received_at = models.DateTimeField(null=True, blank=True)
    verification_status = models.CharField(
        max_length=16,
        choices=LabResultVerificationStatus.choices,
        default=LabResultVerificationStatus.PENDING,
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_external_certs_verified",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="lab_external_certs_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Lab external certificate"
        verbose_name_plural = "Lab external certificates"

    def __str__(self) -> str:
        return f"{self.external_lab_reference}/{self.certificate_reference or self.id}"


class LabPositiveReleasePolicy(models.Model):
    """
    Organization policy stub for future positive-release gating.

    Defaults OFF. Even when `policy_enabled` is True, runtime blocking remains
    disabled until company QA approval is recorded (see policy service /
    LAB_POSITIVE_RELEASE_BLOCKING_APPROVED setting — default False).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="lab_positive_release_policy",
    )
    policy_enabled = models.BooleanField(
        default=False,
        help_text="Company may enable policy definition — does not alone block RELEASE.",
    )
    require_finalized_results = models.BooleanField(
        default=True,
        help_text="When blocking is approved+enabled, require finalized linked results.",
    )
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Owner notes only — not an approved SOP text.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_positive_release_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Lab positive-release policy"
        verbose_name_plural = "Lab positive-release policies"

    def __str__(self) -> str:
        return f"positive-release/{self.organization.code}"


class LabAuditEventKind(models.TextChoices):
    SAMPLE_CREATED = "SAMPLE_CREATED", "Sample created"
    SAMPLE_STATUS_CHANGED = "SAMPLE_STATUS_CHANGED", "Sample status changed"
    TEST_CREATED = "TEST_CREATED", "Test created"
    RESULT_ENTERED = "RESULT_ENTERED", "Result entered"
    RESULT_VERIFIED = "RESULT_VERIFIED", "Result verified"
    RESULT_FINALIZED = "RESULT_FINALIZED", "Result finalized"
    RESULT_AMENDED = "RESULT_AMENDED", "Result amended"
    EXTERNAL_CERT_RECORDED = "EXTERNAL_CERT_RECORDED", "External certificate recorded"
    POLICY_UPDATED = "POLICY_UPDATED", "Positive-release policy updated"


class LabHistoryEntry(models.Model):
    """Domain history for lab objects — keep notes short; no sensitive free-text dumps."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="lab_history_entries",
    )
    sample = models.ForeignKey(
        LabSample,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    lab_result = models.ForeignKey(
        LabResult,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    event_type = models.CharField(max_length=32, choices=LabAuditEventKind.choices)
    from_status = models.CharField(max_length=16, blank=True, default="")
    to_status = models.CharField(max_length=16, blank=True, default="")
    note = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="lab_history_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Lab history entry"
        verbose_name_plural = "Lab history entries"

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at:%Y-%m-%d}"
