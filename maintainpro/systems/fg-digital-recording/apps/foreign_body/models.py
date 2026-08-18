"""Foreign-body / metal-detector challenge-test foundation — Phase 26.

Configurable shells only. Do not invent test-piece sizes, Fe/Non-Fe/SS limits,
test frequencies, retrospective HOLD rules, or corrective actions.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization, Site


class ChallengeTestStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    RECORDED = "RECORDED", "Recorded"
    VERIFIED = "VERIFIED", "Verified"
    VOID = "VOID", "Void (retained)"


class ChallengeTestResult(models.TextChoices):
    """Deterministic challenge outcome — not a QA disposition."""

    NOT_EVALUATED = "NOT_EVALUATED", "Not evaluated"
    PASS = "PASS", "Pass"
    FAIL = "FAIL", "Fail"


class ChallengeScheduleMode(models.TextChoices):
    """Opaque schedule modes — frequencies remain company-configured."""

    AD_HOC = "AD_HOC", "Ad hoc"
    SHIFT = "SHIFT", "Shift-based"
    BATCH = "BATCH", "Batch-linked"
    CHECKLIST_TASK = "CHECKLIST_TASK", "Checklist / scheduler task"


class TestPiece(models.Model):
    """
    Configurable challenge-piece catalogue entry.

    category_label / size_label are opaque company strings — never seed Fe/Non-Fe/SS
    dimensions or sensitivities from memory.
    """

    __test__ = False  # avoid pytest collecting this Django model as a test class

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="foreign_body_test_pieces",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    category_label = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Opaque material/category label (company-supplied). Not a seeded Fe/SS table.",
    )
    size_label = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Opaque size/sensitivity label. Leave blank until company evidence loads values.",
    )
    # When True, challenge expects the detector to reject/detect the piece.
    expected_detected = models.BooleanField(
        default=True,
        help_text="Configured expected detection outcome for this piece (company-approved).",
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="foreign_body_test_pieces_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Test piece"
        verbose_name_plural = "Test pieces"
        permissions = [
            ("manage_testpiece", "Can manage foreign-body test-piece catalogue"),
            ("record_challengeresult", "Can record metal-detector challenge tests"),
            ("verify_challengeresult", "Can verify metal-detector challenge tests"),
            ("view_foreignbody", "Can view foreign-body challenge history"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="fb_test_piece_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class ChallengeScheduleRule(models.Model):
    """
    Opaque schedule binding shell (shift / batch / checklist).

    Does not invent frequencies or intervals — rule_code is company-authored.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="foreign_body_schedule_rules",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255, blank=True, default="")
    schedule_mode = models.CharField(
        max_length=32,
        choices=ChallengeScheduleMode.choices,
        default=ChallengeScheduleMode.AD_HOC,
    )
    rule_code = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque company schedule/rule reference — not an invented frequency.",
    )
    equipment = models.ForeignKey(
        "instruments.Equipment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="foreign_body_schedule_rules",
    )
    checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="foreign_body_schedule_rules",
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="foreign_body_schedule_rules_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Challenge schedule rule"
        verbose_name_plural = "Challenge schedule rules"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="fb_schedule_rule_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"


class MetalDetectorChallengeTest(models.Model):
    """
    Generic metal-detector / foreign-body challenge verification record.

    Historical rows are PROTECT-retained. Prefer VOID over hard delete.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="metal_detector_challenge_tests",
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="metal_detector_challenge_tests",
    )
    equipment = models.ForeignKey(
        "instruments.Equipment",
        on_delete=models.PROTECT,
        related_name="metal_detector_challenge_tests",
    )
    production_line_code = models.CharField(max_length=64, blank=True, default="")
    batch_reference = models.CharField(max_length=128, blank=True, default="")
    sub_lot_reference = models.CharField(max_length=128, blank=True, default="")
    performed_at = models.DateTimeField()
    test_piece = models.ForeignKey(
        TestPiece,
        on_delete=models.PROTECT,
        related_name="challenge_tests",
    )
    expected_detected = models.BooleanField(
        help_text="Snapshot of configured expectation at record time."
    )
    observed_detected = models.BooleanField(
        null=True,
        blank=True,
        help_text="Whether the detector indicated detection/reject during the challenge.",
    )
    result = models.CharField(
        max_length=16,
        choices=ChallengeTestResult.choices,
        default=ChallengeTestResult.NOT_EVALUATED,
    )
    status = models.CharField(
        max_length=16,
        choices=ChallengeTestStatus.choices,
        default=ChallengeTestStatus.DRAFT,
    )
    schedule_mode = models.CharField(
        max_length=32,
        choices=ChallengeScheduleMode.choices,
        default=ChallengeScheduleMode.AD_HOC,
    )
    schedule_rule = models.ForeignKey(
        ChallengeScheduleRule,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="challenge_tests",
    )
    checklist_task = models.ForeignKey(
        "scheduling.ChecklistTask",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="foreign_body_challenge_tests",
    )
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="foreign_body_challenges_operated",
    )
    verifier = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="foreign_body_challenges_verified",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    evidence_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Opaque evidence/attachment reference (secure evidence module later).",
    )
    notes = models.TextField(blank=True, default="")
    frozen_device_context = models.JSONField(default=dict, blank=True)
    frozen_test_piece_context = models.JSONField(default=dict, blank=True)
    void_reason = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="foreign_body_challenges_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-performed_at", "-created_at")
        verbose_name = "Metal detector challenge test"
        verbose_name_plural = "Metal detector challenge tests"
        indexes = [
            models.Index(
                fields=["organization", "performed_at"],
                name="fb_challenge_org_perf_idx",
            ),
            models.Index(
                fields=["equipment", "performed_at"],
                name="fb_challenge_equip_perf_idx",
            ),
            models.Index(
                fields=["organization", "batch_reference"],
                name="fb_challenge_org_batch_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"Challenge {self.id} ({self.result}/{self.status})"

    @property
    def is_immutable(self) -> bool:
        return self.status in {
            ChallengeTestStatus.VERIFIED,
            ChallengeTestStatus.VOID,
        }

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        equipment = self.equipment
        if equipment is not None and self.organization_id:
            if equipment.organization_id != self.organization_id:
                errors["equipment"] = "Equipment must belong to the organization."
        test_piece = self.test_piece
        if test_piece is not None and self.organization_id:
            if test_piece.organization_id != self.organization_id:
                errors["test_piece"] = "Test piece must belong to the organization."
        site = self.site
        if site is not None and self.organization_id:
            if site.organization_id != self.organization_id:
                errors["site"] = "Site must belong to the organization."
        if errors:
            raise ValidationError(errors)


class ContainmentAssessment(models.Model):
    """
    Architectural record of a failed-check affected interval.

    Does NOT create HoldCase unless FOREIGN_BODY_AUTO_HOLD_APPROVED is explicitly true
    and company policy wiring is enabled. Advisory by default.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="foreign_body_containment_assessments",
    )
    failed_test = models.OneToOneField(
        MetalDetectorChallengeTest,
        on_delete=models.PROTECT,
        related_name="containment_assessment",
    )
    previous_pass_test = models.ForeignKey(
        MetalDetectorChallengeTest,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="containment_as_previous_pass",
    )
    interval_start = models.DateTimeField(null=True, blank=True)
    interval_end = models.DateTimeField(null=True, blank=True)
    affected_batch_references = models.JSONField(default=list, blank=True)
    hold_recommended = models.BooleanField(
        default=False,
        help_text="Advisory only — not a QA HOLD disposition.",
    )
    hold_created = models.BooleanField(
        default=False,
        help_text="True only when auto-HOLD was explicitly approved and executed.",
    )
    hold_case = models.ForeignKey(
        "nonconformance.HoldCase",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="foreign_body_containment_assessments",
    )
    assessment_context = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="foreign_body_containments_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Foreign-body containment assessment"
        verbose_name_plural = "Foreign-body containment assessments"

    def __str__(self) -> str:
        return f"Containment for {self.failed_test_id}"


class ForeignBodyHistoryEntry(models.Model):
    """Append-only domain history (complements SecurityAuditEvent)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="foreign_body_history_entries",
    )
    challenge_test = models.ForeignKey(
        MetalDetectorChallengeTest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    event_type = models.CharField(max_length=64)
    note = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="foreign_body_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Foreign-body history entry"
        verbose_name_plural = "Foreign-body history entries"

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at}"
