"""Product recall / withdrawal case management — Phases 37–38.

Controlled case management only. Does not invent regulatory recall classes,
reporting times, or notification obligations. External notification and ERP
distribution pulls remain dual-gated OFF (APR-062).

Phase 38: MOCK_EXERCISE mode is visually and technically distinct from real
recalls — mocks never change ERP stock, send real notifications, create
regulatory notifications, or block dispatch (ADR-049 / APR-063).
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization

MOCK_RECALL_CODE_PREFIX = "MOCK-"
MOCK_RECALL_BANNER = "MOCK EXERCISE — NOT A REAL RECALL"
MOCK_RECALL_CASE_TYPE = "MOCK_EXERCISE"


class RecallCaseMode(models.TextChoices):
    """Technical mode — MOCK is never a regulatory classification."""

    REAL = "REAL", "Real recall / withdrawal"
    MOCK_EXERCISE = "MOCK_EXERCISE", "MOCK EXERCISE — not a real recall"


class RecallCaseStatus(models.TextChoices):
    """Technical workflow statuses — not regulatory classification."""

    DRAFT = "DRAFT", "Draft"
    OPEN = "OPEN", "Open"
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    RECONCILING = "RECONCILING", "Quantity reconciliation"
    PENDING_CLOSURE = "PENDING_CLOSURE", "Pending closure"
    CLOSED = "CLOSED", "Closed"
    CANCELLED = "CANCELLED", "Cancelled"


RECALL_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    RecallCaseStatus.DRAFT: frozenset({RecallCaseStatus.OPEN, RecallCaseStatus.CANCELLED}),
    RecallCaseStatus.OPEN: frozenset(
        {
            RecallCaseStatus.IN_PROGRESS,
            RecallCaseStatus.RECONCILING,
            RecallCaseStatus.PENDING_CLOSURE,
            RecallCaseStatus.CANCELLED,
        }
    ),
    RecallCaseStatus.IN_PROGRESS: frozenset(
        {
            RecallCaseStatus.RECONCILING,
            RecallCaseStatus.PENDING_CLOSURE,
            RecallCaseStatus.CANCELLED,
        }
    ),
    RecallCaseStatus.RECONCILING: frozenset(
        {
            RecallCaseStatus.IN_PROGRESS,
            RecallCaseStatus.PENDING_CLOSURE,
            RecallCaseStatus.CANCELLED,
        }
    ),
    RecallCaseStatus.PENDING_CLOSURE: frozenset(
        {
            RecallCaseStatus.CLOSED,
            RecallCaseStatus.IN_PROGRESS,
            RecallCaseStatus.CANCELLED,
        }
    ),
    RecallCaseStatus.CLOSED: frozenset(),
    RecallCaseStatus.CANCELLED: frozenset(),
}


class RecallCase(models.Model):
    """
    Organization-scoped recall/withdrawal case.

    case_type_reference is an opaque company/procedure reference — not a seeded
    regulatory class catalogue.

    Mock exercises use mode=MOCK_EXERCISE + is_mock=True + MOCK- code prefix and
    never affect live inventory, notifications, or dispatch.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="recall_cases",
    )
    code = models.CharField(max_length=64, help_text="Opaque case ID / reference.")
    mode = models.CharField(
        max_length=16,
        choices=RecallCaseMode.choices,
        default=RecallCaseMode.REAL,
        help_text="REAL vs MOCK_EXERCISE — mock never affects live inventory/notify.",
    )
    is_mock = models.BooleanField(
        default=False,
        help_text="Denormalized mock flag — must match mode=MOCK_EXERCISE.",
    )
    case_type_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque type/procedure reference — not a regulatory class invent.",
    )
    reason = models.TextField()
    status = models.CharField(
        max_length=32,
        choices=RecallCaseStatus.choices,
        default=RecallCaseStatus.DRAFT,
    )
    scope_notes = models.TextField(
        blank=True,
        default="",
        help_text="Free-text scope description — company SOPs EVIDENCE REQUIRED.",
    )
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recall_cases_initiated",
        null=True,
        blank=True,
    )
    initiated_at = models.DateTimeField(null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recall_cases_owned",
        null=True,
        blank=True,
    )
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recall_cases_closed",
        null=True,
        blank=True,
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    closure_notes = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Recall case"
        verbose_name_plural = "Recall cases"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="recall_case_org_code_ci_uniq",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(is_mock=True, mode=RecallCaseMode.MOCK_EXERCISE)
                    | models.Q(is_mock=False, mode=RecallCaseMode.REAL)
                ),
                name="recall_case_mock_mode_consistent",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "code"]),
            models.Index(fields=["organization", "is_mock"]),
            models.Index(fields=["organization", "mode"]),
        ]
        permissions = [
            ("view_recall", "Can view recall/withdrawal cases"),
            (
                "initiate_recall",
                "Can initiate recall/withdrawal cases (high-risk; not System Admin by default)",
            ),
            ("manage_recallcase", "Can update recall case scope and quantities"),
            ("close_recall", "Can close recall/withdrawal cases"),
            ("manage_recallpolicy", "Can manage recall policy stubs"),
            (
                "run_mock_recall",
                "Can run mock recall exercises (never a real recall)",
            ),
            (
                "manage_mock_recall_findings",
                "Can record mock findings and explicitly link NCR/CAPA/improvement",
            ),
        ]

    def __str__(self) -> str:
        prefix = "[MOCK] " if self.is_mock else ""
        return f"{prefix}{self.code}/{self.status}"

    @property
    def visual_banner(self) -> str:
        return MOCK_RECALL_BANNER if self.is_mock else ""

    @property
    def display_banner(self) -> str:
        """Alias for serialize / UI — same as visual_banner."""
        return self.visual_banner

    def clean(self) -> None:
        super().clean()
        code = (self.code or "").strip()
        if not code:
            raise ValidationError({"code": "Case ID / code is required."})
        self.code = code
        if not (self.reason or "").strip():
            raise ValidationError({"reason": "Reason is required."})

        mock_mode = self.mode == RecallCaseMode.MOCK_EXERCISE
        if self.is_mock != mock_mode:
            raise ValidationError({"is_mock": "is_mock must match mode=MOCK_EXERCISE."})
        if self.is_mock:
            if not code.upper().startswith(MOCK_RECALL_CODE_PREFIX):
                raise ValidationError(
                    {
                        "code": (
                            f"Mock recall codes must start with {MOCK_RECALL_CODE_PREFIX} "
                            "so they cannot be confused with real recalls."
                        )
                    }
                )
            if not (self.case_type_reference or "").strip():
                self.case_type_reference = MOCK_RECALL_CASE_TYPE
        else:
            if code.upper().startswith(MOCK_RECALL_CODE_PREFIX):
                raise ValidationError(
                    {
                        "code": (
                            f"Real recall codes must not use the {MOCK_RECALL_CODE_PREFIX} "
                            "prefix (reserved for mock exercises)."
                        )
                    }
                )


class RecallAffectedProduct(models.Model):
    """Opaque product reference on a recall case — no invented SKU catalogue."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recall_case = models.ForeignKey(
        RecallCase,
        on_delete=models.PROTECT,
        related_name="affected_products",
    )
    product_reference = models.CharField(max_length=128)
    notes = models.CharField(max_length=512, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("product_reference"),
                "recall_case",
                name="recall_product_case_ref_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return self.product_reference


class RecallAffectedBatch(models.Model):
    """Affected batch / lot reference; optional genealogy node link."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recall_case = models.ForeignKey(
        RecallCase,
        on_delete=models.PROTECT,
        related_name="affected_batches",
    )
    batch_reference = models.CharField(max_length=128)
    genealogy_node_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Optional Phase 36 GenealogyNode id — reference only.",
    )
    genealogy_node_kind = models.CharField(max_length=32, blank=True, default="")
    selected_via = models.CharField(
        max_length=64,
        blank=True,
        default="MANUAL",
        help_text="MANUAL | GENEALOGY_EXPANSION — how the batch entered the case.",
    )
    notes = models.CharField(max_length=512, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("batch_reference"),
                "recall_case",
                name="recall_batch_case_ref_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["recall_case", "batch_reference"]),
        ]

    def __str__(self) -> str:
        return self.batch_reference


class RecallQuantityLine(models.Model):
    """
    Quantity reconciliation shell for an affected batch.

    Opaque quantity/UOM strings from ERP/operations — no invented acceptable
    variance thresholds or pass/fail math.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recall_case = models.ForeignKey(
        RecallCase,
        on_delete=models.PROTECT,
        related_name="quantity_lines",
    )
    affected_batch = models.ForeignKey(
        RecallAffectedBatch,
        on_delete=models.PROTECT,
        related_name="quantity_lines",
    )
    produced_reference = models.CharField(max_length=128, blank=True, default="")
    distributed_reference = models.CharField(max_length=128, blank=True, default="")
    remaining_reference = models.CharField(max_length=128, blank=True, default="")
    recovered_reference = models.CharField(max_length=128, blank=True, default="")
    disposed_reference = models.CharField(max_length=128, blank=True, default="")
    reworked_reference = models.CharField(max_length=128, blank=True, default="")
    uom_reference = models.CharField(max_length=64, blank=True, default="")
    erp_source_system = models.CharField(max_length=64, blank=True, default="")
    erp_source_event_id = models.CharField(max_length=128, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recall_quantity_lines_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["recall_case", "affected_batch"],
                name="recall_qty_case_batch_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"QTY/{self.affected_batch.batch_reference}"


class RecallCommunicationRecord(models.Model):
    """
    Communication reference / evidence shell.

    Does not send messages. Automatic authority/customer contact remains
    dual-gated OFF (APR-062).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recall_case = models.ForeignKey(
        RecallCase,
        on_delete=models.PROTECT,
        related_name="communications",
    )
    reference = models.CharField(max_length=128)
    channel_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque channel/procedure reference — not an auto-send.",
    )
    audience_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque audience label — no customer PII invent.",
    )
    evidence_attachment_id = models.UUIDField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recall_communications_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self) -> str:
        return self.reference


class RecallTimelineEntry(models.Model):
    """Immutable append-only recall case timeline."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recall_case = models.ForeignKey(
        RecallCase,
        on_delete=models.PROTECT,
        related_name="timeline_entries",
    )
    event_type = models.CharField(max_length=64)
    summary = models.CharField(max_length=512)
    payload = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recall_timeline_entries",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["recall_case", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.event_type}@{self.created_at:%Y-%m-%d}"


class RecallPolicy(models.Model):
    """Org policy stubs — external notify / ERP pull dual-gated OFF (APR-062)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="recall_policy",
    )
    external_notification_enabled = models.BooleanField(
        default=False,
        help_text="Org stub only — still requires RECALL_EXTERNAL_NOTIFICATION_APPROVED.",
    )
    erp_distribution_pull_enabled = models.BooleanField(
        default=False,
        help_text="Org stub only — still requires RECALL_ERP_DISTRIBUTION_PULL_APPROVED.",
    )
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recall_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Recall policy"
        verbose_name_plural = "Recall policies"

    def __str__(self) -> str:
        return f"{self.organization.code} recall policy"


class MockCompletenessMark(models.TextChoices):
    """Opaque exercise assessment marks — not invented scoring thresholds."""

    NOT_ASSESSED = "NOT_ASSESSED", "Not assessed"
    COMPLETE = "COMPLETE", "Complete (operator assessment)"
    PARTIAL = "PARTIAL", "Partial (operator assessment)"
    GAPS_IDENTIFIED = "GAPS_IDENTIFIED", "Gaps identified"


class MockFindingLinkKind(models.TextChoices):
    NONE = "NONE", "Finding only"
    NCR = "NCR", "Linked nonconformance"
    CAPA = "CAPA", "Linked CAPA"
    IMPROVEMENT = "IMPROVEMENT", "Linked improvement action"


class MockExerciseMetrics(models.Model):
    """
    Mock recall exercise metrics (Phase 38).

    Captures started/completed, scope, trace completeness, quantity
    reconciliation, gaps, and actions. No invented pass/fail scores.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recall_case = models.OneToOneField(
        RecallCase,
        on_delete=models.PROTECT,
        related_name="mock_metrics",
        limit_choices_to={"is_mock": True},
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    scope_snapshot = models.TextField(blank=True, default="")
    traceback_completeness = models.CharField(
        max_length=32,
        choices=MockCompletenessMark.choices,
        default=MockCompletenessMark.NOT_ASSESSED,
    )
    traceback_notes = models.TextField(blank=True, default="")
    traceforward_completeness = models.CharField(
        max_length=32,
        choices=MockCompletenessMark.choices,
        default=MockCompletenessMark.NOT_ASSESSED,
    )
    traceforward_notes = models.TextField(blank=True, default="")
    quantity_reconciliation_notes = models.TextField(
        blank=True,
        default="",
        help_text="Opaque qty reconciliation notes — no invented variance rules.",
    )
    gaps = models.JSONField(
        default=list,
        blank=True,
        help_text="List of opaque gap descriptions — not invented scoring.",
    )
    actions = models.JSONField(
        default=list,
        blank=True,
        help_text="List of opaque action descriptions taken during the exercise.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="mock_recall_metrics_updated",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Mock recall exercise metrics"
        verbose_name_plural = "Mock recall exercise metrics"

    def __str__(self) -> str:
        return f"[MOCK] metrics:{self.recall_case.code}"

    def clean(self) -> None:
        super().clean()
        if self.recall_case_id and not self.recall_case.is_mock:
            raise ValidationError(
                {"recall_case": "Mock metrics require a MOCK_EXERCISE recall case."}
            )
        if self.completed_at and self.started_at and self.completed_at < self.started_at:
            raise ValidationError({"completed_at": "completed_at cannot be before started_at."})


class MockRecallFinding(models.Model):
    """
    Mock-recall finding. NCR/CAPA/improvement links require explicit user action.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recall_case = models.ForeignKey(
        RecallCase,
        on_delete=models.PROTECT,
        related_name="mock_findings",
        limit_choices_to={"is_mock": True},
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    link_kind = models.CharField(
        max_length=16,
        choices=MockFindingLinkKind.choices,
        default=MockFindingLinkKind.NONE,
    )
    nonconformance_id = models.UUIDField(null=True, blank=True)
    capa_id = models.UUIDField(null=True, blank=True)
    improvement_action_id = models.UUIDField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="mock_recall_findings_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["recall_case", "link_kind"]),
        ]

    def __str__(self) -> str:
        return f"[MOCK] {self.recall_case.code}:{self.title}"

    def clean(self) -> None:
        super().clean()
        if self.recall_case_id and not self.recall_case.is_mock:
            raise ValidationError(
                {"recall_case": "Findings are only allowed on mock recall exercises."}
            )
        title = (self.title or "").strip()
        if not title:
            raise ValidationError({"title": "Title is required."})
        self.title = title


class MockImprovementAction(models.Model):
    """Opaque improvement action spawned from a mock finding (explicit user action)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recall_case = models.ForeignKey(
        RecallCase,
        on_delete=models.PROTECT,
        related_name="mock_improvement_actions",
        limit_choices_to={"is_mock": True},
    )
    finding = models.ForeignKey(
        MockRecallFinding,
        on_delete=models.PROTECT,
        related_name="improvement_actions",
        null=True,
        blank=True,
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="mock_improvement_actions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "recall_case",
                name="mock_improvement_case_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"[MOCK] {self.code}:{self.title}"
