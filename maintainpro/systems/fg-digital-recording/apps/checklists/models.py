"""Checklist definition models — configurable, unseeded; TEMPLATE evidence required."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.functions import Lower

from apps.master_data.models import FGProduct
from apps.organizations.models import Organization


class ChecklistVersionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PUBLISHED = "PUBLISHED", "Published"
    RETIRED = "RETIRED", "Retired"


class ChecklistResponseType(models.TextChoices):
    """Technical response primitives — not product-specific business rules."""

    YES_NO = "YES_NO", "Yes / No"
    YES_NO_NA = "YES_NO_NA", "Yes / No / N/A"
    NUMBER = "NUMBER", "Number"
    TEXT = "TEXT", "Text"
    SELECT = "SELECT", "Select"


class ChecklistItemKind(models.TextChoices):
    """
    Engine v2 item structure (ADR-019 / Phases 06H–06I).

    CALCULATED uses closed whitelist operators only (no eval / expression language).
    """

    SIMPLE = "SIMPLE", "Simple"
    REPEATING_GROUP = "REPEATING_GROUP", "Repeating group"
    CALCULATED = "CALCULATED", "Calculated"


class ChecklistCalculationOperator(models.TextChoices):
    """Closed calculation operators — ADR-019 Phase 06I. Not free-form formulas."""

    SUM = "SUM", "Sum"
    AVERAGE = "AVERAGE", "Average"
    MIN = "MIN", "Minimum"
    MAX = "MAX", "Maximum"
    COUNT = "COUNT", "Count"
    RANGE = "RANGE", "Range (max − min)"


class ChecklistConditionRuleKind(models.TextChoices):
    """Closed conditional rule kinds — ADR-019 Phase 06J."""

    VISIBLE_IF = "VISIBLE_IF", "Visible if"
    REQUIRED_IF = "REQUIRED_IF", "Required if"
    EVIDENCE_REQUIRED_IF = "EVIDENCE_REQUIRED_IF", "Evidence required if"


class ChecklistConditionComparator(models.TextChoices):
    """Closed predicate comparators — ADR-019 Phase 06J. No expression language.

    Canonical tokens: EQ/NE/IN/GT/GTE/LT/LTE/IS_ANSWERED plus IS_EMPTY/IS_NOT_EMPTY
    (empty-check aliases requested for 06J UX clarity). Long-form aliases such as
    EQUALS normalize to these tokens in services — never executed as expressions.
    """

    EQ = "EQ", "Equals"
    NE = "NE", "Not equals"
    IN = "IN", "In list"
    GT = "GT", "Greater than"
    GTE = "GTE", "Greater than or equal"
    LT = "LT", "Less than"
    LTE = "LTE", "Less than or equal"
    IS_ANSWERED = "IS_ANSWERED", "Is answered"
    IS_EMPTY = "IS_EMPTY", "Is empty"
    IS_NOT_EMPTY = "IS_NOT_EMPTY", "Is not empty"


class ChecklistEvaluationResult(models.TextChoices):
    """
    Item-level measurement/checklist evaluation (Phase 06K / ADR-019).

    HARD INVARIANT — these are NOT QA dispositions:
    PASS ≠ RELEASE, FAIL ≠ HOLD, FAIL ≠ REJECT.
    Evaluation never creates or modifies QAReview.
    """

    PASS = "PASS", "Pass (evaluation only — not QA RELEASE)"
    FAIL = "FAIL", "Fail (evaluation only — not QA HOLD/REJECT)"
    WARN = "WARN", "Warn (evaluation only — not QA disposition)"
    NOT_EVALUATED = "NOT_EVALUATED", "Not evaluated"


class ChecklistEvaluationRuleKind(models.TextChoices):
    """Closed evaluation rule categories — no free-form expressions."""

    NUMERIC_BOUNDS = "NUMERIC_BOUNDS", "Numeric bounds"
    EXPECTED_CHOICE = "EXPECTED_CHOICE", "Expected YES/NO choice"
    EXPECTED_OPTION = "EXPECTED_OPTION", "Expected SELECT option"
    CALCULATED_NUMERIC_BOUNDS = "CALCULATED_NUMERIC_BOUNDS", "Calculated numeric bounds"
    SPECIFICATION_PARAMETER = (
        "SPECIFICATION_PARAMETER",
        "Pinned product specification parameter (Phase 06O)",
    )


class ChecklistControlPointClass(models.TextChoices):
    """
    Generic control-point classification taxonomy (Phase 06L / ADR-019 section 8).

    Default NONE. Non-NONE production values require ASM-002 / APR-027 HACCP/QMS
    evidence — never invent Nelna CCP/OPRP/PRP mappings. Metadata alone never
    HOLD/REJECT/RELEASE, creates NCR, or blocks dispatch.
    """

    NONE = "NONE", "None (unset / not classified)"
    CCP = "CCP", "CCP (evidence-gated)"
    OPRP = "OPRP", "OPRP (evidence-gated)"
    PRP = "PRP", "PRP (evidence-gated)"
    GMP = "GMP", "GMP (evidence-gated)"
    QUALITY = "QUALITY", "Quality (evidence-gated)"


class ChecklistItemCriticality(models.TextChoices):
    """
    Optional criticality metadata for display/reporting extensibility (Phase 06L).

    Blank default — never auto-classified. Production use is EVIDENCE REQUIRED.
    Does not by itself trigger HOLD/REJECT/RELEASE or NCR.
    """

    MINOR = "MINOR", "Minor"
    MAJOR = "MAJOR", "Major"
    CRITICAL = "CRITICAL", "Critical"


class ChecklistRoundingMode(models.TextChoices):
    """
    Explicit rounding modes for measurement semantics (Phase 06M / ADR-019 §4).

    Blank on ChecklistItem means no rounding is applied at capture time.
    Rounding applies only when BOTH decimal_precision and rounding_mode are set.
    Not a business policy default — owners must configure when needed.
    """

    HALF_UP = "HALF_UP", "Half up"
    HALF_EVEN = "HALF_EVEN", "Half even (banker's)"
    FLOOR = "FLOOR", "Floor"
    CEILING = "CEILING", "Ceiling"
    DOWN = "DOWN", "Toward zero"


class ChecklistTemplate(models.Model):
    """
    Stable logical identity of a checklist across versions.

    Codes/names are administrator-configured. No operational checklist rows are seeded.
    Official forms remain gated by TEMPLATE / ASM evidence.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="checklist_templates",
    )
    product = models.ForeignKey(
        FGProduct,
        on_delete=models.PROTECT,
        related_name="checklist_templates",
        null=True,
        blank=True,
        help_text=(
            "Optional provisional Product association — not proven mandatory by business evidence."
        ),
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Checklist template"
        verbose_name_plural = "Checklist templates"
        permissions = [
            ("manage_checklist", "Can manage checklist definitions"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="chk_template_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "is_active"],
                name="chk_template_org_act_idx",
            ),
            models.Index(Lower("code"), name="chk_template_code_lower_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        if not (self.code or "").strip():
            raise ValidationError({"code": "Code cannot be blank."})
        if not (self.name or "").strip():
            raise ValidationError({"name": "Name cannot be blank."})
        if self.product_id is not None and self.organization_id is not None:
            product = self.product
            if product is not None and product.organization_id != self.organization_id:
                raise ValidationError(
                    {"product": "Product must belong to the same organization as the template."}
                )


class ChecklistVersion(models.Model):
    """Immutable publishable definition revision of a ChecklistTemplate."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        ChecklistTemplate,
        on_delete=models.PROTECT,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(
        max_length=16,
        choices=ChecklistVersionStatus.choices,
        default=ChecklistVersionStatus.DRAFT,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)
    # Phase 07D — technical effectivity (APR-015 as-of policy unresolved).
    effective_from = models.DateTimeField(
        null=True,
        blank=True,
        help_text=(
            "Optional inclusive start of PUBLISHED eligibility (UTC). "
            "Blank = unbounded start. APR-015 as-of policy unresolved."
        ),
    )
    effective_to = models.DateTimeField(
        null=True,
        blank=True,
        help_text=(
            "Optional inclusive end of PUBLISHED eligibility (UTC). "
            "Blank = unbounded end. APR-015 as-of policy unresolved."
        ),
    )

    class Meta:
        ordering = ("template__code", "-version_number")
        verbose_name = "Checklist version"
        verbose_name_plural = "Checklist versions"
        constraints = [
            models.UniqueConstraint(
                fields=["template", "version_number"],
                name="chk_version_template_number_uniq",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(effective_to__isnull=True)
                    | models.Q(effective_from__isnull=True)
                    | models.Q(effective_to__gte=models.F("effective_from"))
                ),
                name="chk_version_effective_window_valid",
            ),
        ]
        indexes = [
            models.Index(
                fields=["template", "status"],
                name="chk_version_tmpl_status_idx",
            ),
            models.Index(
                fields=["template", "status", "effective_from", "effective_to"],
                name="chk_version_tmpl_effect_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.template.code} v{self.version_number} ({self.status})"

    @property
    def is_draft(self) -> bool:
        return self.status == ChecklistVersionStatus.DRAFT

    @property
    def is_immutable(self) -> bool:
        return self.status in {
            ChecklistVersionStatus.PUBLISHED,
            ChecklistVersionStatus.RETIRED,
        }

    def is_effective_at(self, as_of: datetime | date) -> bool:
        """True when as_of falls within the inclusive technical effectivity window."""
        if self.effective_from is not None and as_of < self.effective_from:
            return False
        if self.effective_to is not None and as_of > self.effective_to:
            return False
        return True

    def clean(self) -> None:
        super().clean()
        if (
            self.effective_to is not None
            and self.effective_from is not None
            and self.effective_to < self.effective_from
        ):
            raise ValidationError(
                {"effective_to": "effective_to cannot be earlier than effective_from."}
            )


class ChecklistSection(models.Model):
    """Ordered section belonging to exactly one ChecklistVersion."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(
        ChecklistVersion,
        on_delete=models.CASCADE,
        related_name="sections",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    position = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        ordering = ("position", "title")
        verbose_name = "Checklist section"
        verbose_name_plural = "Checklist sections"
        constraints = [
            models.UniqueConstraint(
                fields=["version", "position"],
                name="chk_section_version_position_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.version} / {self.title}"

    def clean(self) -> None:
        super().clean()
        if not (self.title or "").strip():
            raise ValidationError({"title": "Title cannot be blank."})


class ChecklistItem(models.Model):
    """
    Definition metadata for a checklist prompt/question.

    Response primitives are technical definition schema only.
    Numerical Product limits and release automation remain evidence-gated.
    Phase 06H adds optional repeating-group structure (ADR-019).
    Phase 06I adds CALCULATED items with closed operators (no eval).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.ForeignKey(
        ChecklistSection,
        on_delete=models.CASCADE,
        related_name="items",
    )
    parent_item = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="child_items",
        help_text="Set only for children of a REPEATING_GROUP (one level).",
    )
    item_kind = models.CharField(
        max_length=32,
        choices=ChecklistItemKind.choices,
        default=ChecklistItemKind.SIMPLE,
    )
    code = models.CharField(max_length=64)
    label = models.CharField(max_length=500)
    help_text = models.TextField(blank=True, default="")
    position = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    is_required = models.BooleanField(
        default=True,
        help_text="Technical required flag for later recording phases — not a QA rule.",
    )
    response_type = models.CharField(
        max_length=16,
        choices=ChecklistResponseType.choices,
        blank=True,
        default="",
        help_text="Blank allowed on DRAFT only; publish requires a valid response type.",
    )
    unit = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Optional technical unit catalog code for NUMBER items. Not a limit.",
    )
    minimum_value = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Optional NUMBER lower bound. Unset is allowed.",
    )
    maximum_value = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Optional NUMBER upper bound. Unset is allowed.",
    )
    decimal_precision = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text=(
            "Optional Decimal scale for NUMBER items. Null = no forced quantize "
            "(do not invent a business default)."
        ),
    )
    rounding_mode = models.CharField(
        max_length=16,
        choices=ChecklistRoundingMode.choices,
        blank=True,
        default="",
        help_text=(
            "Optional closed rounding mode (HALF_UP/HALF_EVEN/FLOOR/CEILING/DOWN). "
            "Empty = no rounding. Applied only together with decimal_precision."
        ),
    )
    min_inclusive = models.BooleanField(
        default=True,
        help_text="Whether minimum_value is inclusive (informational bounds).",
    )
    max_inclusive = models.BooleanField(
        default=True,
        help_text="Whether maximum_value is inclusive (informational bounds).",
    )
    repeat_min = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Optional minimum sample rows when defined by evidence — not invented.",
    )
    repeat_max = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Optional maximum sample rows when defined by evidence — not invented.",
    )
    repeat_default = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Optional default sample row count when defined — not invented.",
    )
    calculation_operator = models.CharField(
        max_length=16,
        choices=ChecklistCalculationOperator.choices,
        blank=True,
        default="",
        help_text="Closed operator for CALCULATED items only (SUM/AVERAGE/MIN/MAX/COUNT/RANGE).",
    )
    control_point_class = models.CharField(
        max_length=16,
        choices=ChecklistControlPointClass.choices,
        default=ChecklistControlPointClass.NONE,
        help_text=(
            "Generic control-point taxonomy (ADR-019). Default NONE. "
            "Non-NONE production classifications require ASM-002 / APR-027 evidence. "
            "Does not auto HOLD/REJECT/RELEASE."
        ),
    )
    criticality = models.CharField(
        max_length=16,
        choices=ChecklistItemCriticality.choices,
        blank=True,
        default="",
        help_text=(
            "Optional criticality metadata (MINOR/MAJOR/CRITICAL). Blank = unset. "
            "Never auto-assigned. Not a disposition rule."
        ),
    )
    requires_equipment_reference = models.BooleanField(
        default=False,
        help_text=(
            "When True, recording may require an equipment / device reference for this item. "
            "Default False — does not force existing checklist items. "
            "Overdue block/warn policy remains company-configured (Phase 25)."
        ),
    )
    required_equipment_type = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text=(
            "Optional equipment-type filter (SCALE/THERMOMETER/…). Blank = any type. "
            "Does not invent a company type catalogue beyond the technical taxonomy."
        ),
    )

    class Meta:
        ordering = ("position", "code")
        verbose_name = "Checklist item"
        verbose_name_plural = "Checklist items"
        constraints = [
            models.UniqueConstraint(
                fields=["section", "position"],
                name="chk_item_section_position_uniq",
            ),
            models.UniqueConstraint(
                Lower("code"),
                "section",
                name="chk_item_section_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["section", "parent_item", "position"],
                name="chk_item_sect_parent_pos_idx",
            ),
            models.Index(fields=["item_kind"], name="chk_item_kind_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.code}: {self.label}"

    @property
    def is_repeating_group(self) -> bool:
        return self.item_kind == ChecklistItemKind.REPEATING_GROUP

    @property
    def is_simple(self) -> bool:
        return self.item_kind == ChecklistItemKind.SIMPLE

    @property
    def is_calculated(self) -> bool:
        return self.item_kind == ChecklistItemKind.CALCULATED

    def clean(self) -> None:
        from apps.checklists.constants import REPEAT_SAMPLE_TECHNICAL_CEILING

        super().clean()
        if not (self.code or "").strip():
            raise ValidationError({"code": "Code cannot be blank."})
        if not (self.label or "").strip():
            raise ValidationError({"label": "Label cannot be blank."})

        kind = (self.item_kind or "").strip() or ChecklistItemKind.SIMPLE
        if kind not in ChecklistItemKind.values:
            raise ValidationError({"item_kind": "Unknown item kind."})

        cp = (self.control_point_class or "").strip().upper() or ChecklistControlPointClass.NONE
        if cp not in ChecklistControlPointClass.values:
            raise ValidationError({"control_point_class": "Unknown control-point class."})
        self.control_point_class = cp

        crit = (self.criticality or "").strip().upper()
        if crit and crit not in ChecklistItemCriticality.values:
            raise ValidationError({"criticality": "Unknown criticality value."})
        self.criticality = crit

        if self.parent_item_id is not None:
            parent = self.parent_item
            if parent is None:
                raise ValidationError({"parent_item": "Parent item not found."})
            if parent.section_id != self.section_id:
                raise ValidationError(
                    {"parent_item": "Parent item must belong to the same section."}
                )
            if parent.item_kind != ChecklistItemKind.REPEATING_GROUP:
                raise ValidationError({"parent_item": "Parent item must be a REPEATING_GROUP."})
            if parent.parent_item_id is not None:
                raise ValidationError({"parent_item": "Nested repeating groups are not supported."})
            if kind not in {ChecklistItemKind.SIMPLE, ChecklistItemKind.CALCULATED}:
                raise ValidationError(
                    {
                        "item_kind": (
                            "Only SIMPLE or CALCULATED children are supported under a "
                            "REPEATING_GROUP."
                        )
                    }
                )

        if kind == ChecklistItemKind.REPEATING_GROUP:
            if self.parent_item_id is not None:
                raise ValidationError(
                    {"parent_item": "A REPEATING_GROUP cannot be nested under another item."}
                )
            if (self.response_type or "").strip():
                raise ValidationError(
                    {"response_type": "REPEATING_GROUP items do not take a response type."}
                )
            if (
                self.unit
                or self.minimum_value is not None
                or self.maximum_value is not None
                or self.decimal_precision is not None
                or (self.rounding_mode or "").strip()
            ):
                raise ValidationError(
                    {"response_type": "REPEATING_GROUP items cannot have numeric limits or unit."}
                )
            if (self.calculation_operator or "").strip():
                raise ValidationError(
                    {
                        "calculation_operator": (
                            "REPEATING_GROUP items cannot have a calculation operator."
                        )
                    }
                )
            for field_name in ("repeat_min", "repeat_max", "repeat_default"):
                value = getattr(self, field_name)
                if value is not None and value > REPEAT_SAMPLE_TECHNICAL_CEILING:
                    raise ValidationError(
                        {
                            field_name: (
                                f"Cannot exceed technical sample ceiling "
                                f"({REPEAT_SAMPLE_TECHNICAL_CEILING})."
                            )
                        }
                    )
            if (
                self.repeat_min is not None
                and self.repeat_max is not None
                and self.repeat_min > self.repeat_max
            ):
                raise ValidationError(
                    {"repeat_min": "repeat_min cannot be greater than repeat_max."}
                )
            if self.repeat_default is not None:
                if self.repeat_min is not None and self.repeat_default < self.repeat_min:
                    raise ValidationError(
                        {"repeat_default": "repeat_default cannot be less than repeat_min."}
                    )
                if self.repeat_max is not None and self.repeat_default > self.repeat_max:
                    raise ValidationError(
                        {"repeat_default": "repeat_default cannot exceed repeat_max."}
                    )
            return

        if any(
            value is not None for value in (self.repeat_min, self.repeat_max, self.repeat_default)
        ):
            raise ValidationError(
                {"repeat_min": "Repeat configuration is only allowed on REPEATING_GROUP items."}
            )

        if kind == ChecklistItemKind.CALCULATED:
            operator = (self.calculation_operator or "").strip().upper()
            if operator and operator not in ChecklistCalculationOperator.values:
                raise ValidationError({"calculation_operator": "Unknown calculation operator."})
            # Storage type is always NUMBER for calculated results.
            if (self.response_type or "").strip() not in ("", ChecklistResponseType.NUMBER):
                raise ValidationError(
                    {"response_type": "CALCULATED items must use NUMBER storage (or blank)."}
                )
            if self.minimum_value is not None or self.maximum_value is not None:
                raise ValidationError(
                    {
                        "minimum_value": (
                            "CALCULATED items do not use min/max definition bounds in 06I."
                        )
                    }
                )
            from apps.checklists.measurement import (
                assert_known_unit,
                assert_precision_rounding_pair,
            )

            if self.unit:
                self.unit = assert_known_unit(self.unit)
            self.decimal_precision, self.rounding_mode = assert_precision_rounding_pair(
                decimal_precision=self.decimal_precision,
                rounding_mode=self.rounding_mode,
            )
            return

        # SIMPLE leaf
        if (self.calculation_operator or "").strip():
            raise ValidationError(
                {
                    "calculation_operator": (
                        "calculation_operator is only allowed on CALCULATED items."
                    )
                }
            )
        from apps.checklists.measurement import (
            assert_known_unit,
            assert_precision_rounding_pair,
        )

        if (self.response_type or "").strip() == ChecklistResponseType.NUMBER:
            if self.unit:
                self.unit = assert_known_unit(self.unit)
            self.decimal_precision, self.rounding_mode = assert_precision_rounding_pair(
                decimal_precision=self.decimal_precision,
                rounding_mode=self.rounding_mode,
            )
        else:
            self.decimal_precision = None
            self.rounding_mode = ""

        errors = validate_item_response_definition(
            response_type=self.response_type,
            unit=self.unit,
            minimum_value=self.minimum_value,
            maximum_value=self.maximum_value,
            decimal_precision=self.decimal_precision,
            rounding_mode=self.rounding_mode,
            require_response_type=False,
        )
        if errors:
            raise ValidationError(errors)


class ChecklistCalculationOperand(models.Model):
    """
    Ordered operand reference for a CALCULATED ChecklistItem.

    Same-version only. No arbitrary object / cross-org references.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    calculated_item = models.ForeignKey(
        ChecklistItem,
        on_delete=models.CASCADE,
        related_name="calculation_operand_links",
    )
    source_item = models.ForeignKey(
        ChecklistItem,
        on_delete=models.CASCADE,
        related_name="used_as_calculation_operand_for",
    )
    position = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        ordering = ("position", "pk")
        verbose_name = "Checklist calculation operand"
        verbose_name_plural = "Checklist calculation operands"
        constraints = [
            models.UniqueConstraint(
                fields=["calculated_item", "position"],
                name="chk_calc_operand_pos_uniq",
            ),
            models.UniqueConstraint(
                fields=["calculated_item", "source_item"],
                name="chk_calc_operand_source_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["calculated_item", "position"],
                name="chk_calc_operand_item_pos_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"Operand {self.position} → {self.source_item_id}"

    def clean(self) -> None:
        super().clean()
        if self.calculated_item_id and self.source_item_id:
            if self.calculated_item_id == self.source_item_id:
                raise ValidationError({"source_item": "Cannot reference self as operand."})
            if self.calculated_item.section.version_id != self.source_item.section.version_id:
                raise ValidationError(
                    {"source_item": "Operand must be in the same checklist version."}
                )


class ChecklistItemRule(models.Model):
    """
    Structured conditional rule for one checklist item (Phase 06J / ADR-019).

    Closed rule kinds + comparators only. No free-form expressions.
    Empty by default — no Nelna business predicates are seeded.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    target_item = models.ForeignKey(
        ChecklistItem,
        on_delete=models.CASCADE,
        related_name="condition_rules",
    )
    rule_kind = models.CharField(
        max_length=32,
        choices=ChecklistConditionRuleKind.choices,
    )
    operand_item = models.ForeignKey(
        ChecklistItem,
        on_delete=models.CASCADE,
        related_name="referenced_by_condition_rules",
    )
    comparator = models.CharField(
        max_length=16,
        choices=ChecklistConditionComparator.choices,
    )
    expected_text = models.CharField(max_length=255, blank=True, default="")
    expected_number = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    expected_boolean = models.BooleanField(null=True, blank=True)
    expected_option = models.ForeignKey(
        "ChecklistItemOption",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="condition_rule_expectations",
    )
    expected_list = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ("rule_kind", "pk")
        verbose_name = "Checklist item rule"
        verbose_name_plural = "Checklist item rules"
        constraints = [
            models.UniqueConstraint(
                fields=["target_item", "rule_kind"],
                name="chk_item_rule_kind_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["target_item", "rule_kind"],
                name="chk_item_rule_kind_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.rule_kind} on {self.target_item_id}"

    def clean(self) -> None:
        super().clean()
        kind = (self.rule_kind or "").strip().upper()
        if kind and kind not in ChecklistConditionRuleKind.values:
            raise ValidationError({"rule_kind": "Unknown or disallowed rule kind."})
        comparator = (self.comparator or "").strip().upper()
        if comparator and comparator not in ChecklistConditionComparator.values:
            raise ValidationError({"comparator": "Unknown or disallowed comparator."})
        if self.target_item_id and self.operand_item_id:
            if self.target_item_id == self.operand_item_id:
                raise ValidationError(
                    {"operand_item": "A rule cannot reference its own target as operand."}
                )
            if self.target_item.section.version_id != self.operand_item.section.version_id:
                raise ValidationError(
                    {"operand_item": "Operand must be in the same checklist version."}
                )
            if self.operand_item.item_kind == ChecklistItemKind.REPEATING_GROUP:
                raise ValidationError(
                    {"operand_item": "REPEATING_GROUP containers cannot be condition operands."}
                )
            if self.target_item.item_kind == ChecklistItemKind.REPEATING_GROUP:
                raise ValidationError(
                    {"target_item": "REPEATING_GROUP containers cannot be rule targets."}
                )


class ChecklistItemEvaluationRule(models.Model):
    """
    Explicit deterministic evaluation rule for one checklist item (Phase 06K).

    Empty by default — no Nelna limits or expected answers are seeded.
    Informational ChecklistItem.minimum_value/maximum_value are NOT evaluation
    authority unless an evaluation rule is configured separately.
    Results are measurement/checklist evaluation only — never QA disposition.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.OneToOneField(
        ChecklistItem,
        on_delete=models.CASCADE,
        related_name="evaluation_rule",
    )
    rule_kind = models.CharField(
        max_length=32,
        choices=ChecklistEvaluationRuleKind.choices,
    )
    bound_min = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    bound_max = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    min_inclusive = models.BooleanField(
        null=True,
        blank=True,
        help_text="Required when bound_min is set — no invented default inclusivity.",
    )
    max_inclusive = models.BooleanField(
        null=True,
        blank=True,
        help_text="Required when bound_max is set — no invented default inclusivity.",
    )
    warn_min = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    warn_max = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    warn_min_inclusive = models.BooleanField(null=True, blank=True)
    warn_max_inclusive = models.BooleanField(null=True, blank=True)
    expected_choice = models.CharField(
        max_length=8,
        blank=True,
        default="",
        help_text="YES or NO for EXPECTED_CHOICE rules.",
    )
    expected_option = models.ForeignKey(
        "ChecklistItemOption",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="evaluation_rule_expectations",
    )
    treat_na_as_not_evaluated = models.BooleanField(
        default=True,
        help_text="When True, YES_NO_NA answer NA yields NOT_EVALUATED (not FAIL).",
    )
    specification_version = models.ForeignKey(
        "master_data.SpecificationVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="checklist_evaluation_rules",
        help_text=(
            "Optional exact SpecificationVersion pin for SPECIFICATION_PARAMETER rules. "
            "Historical pins remain valid after version retirement."
        ),
    )
    specification_parameter = models.ForeignKey(
        "master_data.SpecificationParameter",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="checklist_evaluation_rules",
        help_text=(
            "Optional SpecificationParameter pin (must belong to specification_version). "
            "Bounds empty until APR-006 evidence => NOT_EVALUATED."
        ),
    )

    class Meta:
        verbose_name = "Checklist item evaluation rule"
        verbose_name_plural = "Checklist item evaluation rules"

    def __str__(self) -> str:
        return f"{self.rule_kind} on {self.item_id}"

    def clean(self) -> None:
        super().clean()
        kind = (self.rule_kind or "").strip().upper()
        if kind and kind not in ChecklistEvaluationRuleKind.values:
            raise ValidationError({"rule_kind": "Unknown or disallowed evaluation rule kind."})
        if not self.item_id:
            return
        item = self.item
        if item.item_kind == ChecklistItemKind.REPEATING_GROUP:
            raise ValidationError({"item": "REPEATING_GROUP cannot have evaluation rules."})

        if kind in {
            ChecklistEvaluationRuleKind.NUMERIC_BOUNDS,
            ChecklistEvaluationRuleKind.CALCULATED_NUMERIC_BOUNDS,
        }:
            if kind == ChecklistEvaluationRuleKind.NUMERIC_BOUNDS:
                if item.response_type != ChecklistResponseType.NUMBER:
                    raise ValidationError(
                        {"rule_kind": "NUMERIC_BOUNDS requires NUMBER response type."}
                    )
                if item.item_kind != ChecklistItemKind.SIMPLE:
                    raise ValidationError(
                        {"item": "NUMERIC_BOUNDS applies to SIMPLE NUMBER items."}
                    )
            if kind == ChecklistEvaluationRuleKind.CALCULATED_NUMERIC_BOUNDS:
                if item.item_kind != ChecklistItemKind.CALCULATED:
                    raise ValidationError(
                        {"item": "CALCULATED_NUMERIC_BOUNDS requires CALCULATED item."}
                    )
            if self.bound_min is None and self.bound_max is None:
                raise ValidationError(
                    {"bound_min": "At least one of bound_min or bound_max must be set."}
                )
            if self.bound_min is not None and self.min_inclusive is None:
                raise ValidationError(
                    {"min_inclusive": "min_inclusive must be set explicitly when bound_min is set."}
                )
            if self.bound_max is not None and self.max_inclusive is None:
                raise ValidationError(
                    {"max_inclusive": "max_inclusive must be set explicitly when bound_max is set."}
                )
            if (
                self.bound_min is not None
                and self.bound_max is not None
                and self.bound_min > self.bound_max
            ):
                raise ValidationError({"bound_min": "bound_min cannot exceed bound_max."})
            if self.warn_min is not None and self.warn_min_inclusive is None:
                raise ValidationError(
                    {
                        "warn_min_inclusive": (
                            "warn_min_inclusive must be set explicitly when warn_min is set."
                        )
                    }
                )
            if self.warn_max is not None and self.warn_max_inclusive is None:
                raise ValidationError(
                    {
                        "warn_max_inclusive": (
                            "warn_max_inclusive must be set explicitly when warn_max is set."
                        )
                    }
                )
        elif kind == ChecklistEvaluationRuleKind.EXPECTED_CHOICE:
            if item.response_type not in {
                ChecklistResponseType.YES_NO,
                ChecklistResponseType.YES_NO_NA,
            }:
                raise ValidationError(
                    {"rule_kind": "EXPECTED_CHOICE requires YES_NO or YES_NO_NA."}
                )
            choice = (self.expected_choice or "").strip().upper()
            if choice not in {"YES", "NO"}:
                raise ValidationError(
                    {"expected_choice": "expected_choice must be YES or NO (explicit)."}
                )
            self.expected_choice = choice
        elif kind == ChecklistEvaluationRuleKind.EXPECTED_OPTION:
            if item.response_type != ChecklistResponseType.SELECT:
                raise ValidationError({"rule_kind": "EXPECTED_OPTION requires SELECT."})
            if self.expected_option_id is None:
                raise ValidationError({"expected_option": "expected_option is required."})
            expected_option = self.expected_option
            if expected_option is None or expected_option.item_id != item.id:
                raise ValidationError(
                    {"expected_option": "Option must belong to the same checklist item."}
                )
        elif kind == ChecklistEvaluationRuleKind.SPECIFICATION_PARAMETER:
            if item.response_type != ChecklistResponseType.NUMBER:
                raise ValidationError(
                    {"rule_kind": "SPECIFICATION_PARAMETER requires NUMBER response type."}
                )
            if item.item_kind not in {
                ChecklistItemKind.SIMPLE,
                ChecklistItemKind.CALCULATED,
            }:
                raise ValidationError(
                    {
                        "item": (
                            "SPECIFICATION_PARAMETER applies to SIMPLE or CALCULATED NUMBER items."
                        )
                    }
                )
            if self.specification_version_id is None:
                raise ValidationError(
                    {"specification_version": "specification_version is required."}
                )
            if self.specification_parameter_id is None:
                raise ValidationError(
                    {"specification_parameter": "specification_parameter is required."}
                )
            param = self.specification_parameter
            if param is None or str(param.version_id) != str(self.specification_version_id):
                raise ValidationError(
                    {
                        "specification_parameter": (
                            "specification_parameter must belong to the pinned "
                            "specification_version."
                        )
                    }
                )
            version = self.specification_version
            if version is not None:
                spec_org_id = version.specification.organization_id
                checklist_org_id = item.section.version.template.organization_id
                if spec_org_id != checklist_org_id:
                    raise ValidationError(
                        {
                            "specification_version": (
                                "Specification version organization must match the "
                                "checklist template organization."
                            )
                        }
                    )
            if any(
                v is not None
                for v in (self.bound_min, self.bound_max, self.warn_min, self.warn_max)
            ):
                raise ValidationError(
                    {
                        "bound_min": (
                            "SPECIFICATION_PARAMETER uses pinned parameter bounds only; "
                            "do not set inline bound_* / warn_* on the rule."
                        )
                    }
                )


class ChecklistItemOption(models.Model):
    """Ordered SELECT option belonging to exactly one ChecklistItem (version-owned)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(
        ChecklistItem,
        on_delete=models.CASCADE,
        related_name="options",
    )
    value = models.CharField(max_length=64)
    label = models.CharField(max_length=255)
    position = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        ordering = ("position", "value")
        verbose_name = "Checklist item option"
        verbose_name_plural = "Checklist item options"
        constraints = [
            models.UniqueConstraint(
                fields=["item", "position"],
                name="chk_option_item_position_uniq",
            ),
            models.UniqueConstraint(
                Lower("value"),
                "item",
                name="chk_option_item_value_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.value}: {self.label}"

    def clean(self) -> None:
        super().clean()
        if not (self.value or "").strip():
            raise ValidationError({"value": "Option value cannot be blank."})
        if not (self.label or "").strip():
            raise ValidationError({"label": "Option label cannot be blank."})


def validate_item_response_definition(
    *,
    response_type: str,
    unit: str = "",
    minimum_value: Decimal | None = None,
    maximum_value: Decimal | None = None,
    decimal_precision: int | None = None,
    rounding_mode: str = "",
    require_response_type: bool = False,
) -> dict[str, str]:
    """
    Central structural response-definition rules.

    Returns a field→message error map (empty when valid).
    Does not invent Product limits or release rules.
    """
    from apps.checklists.measurement import assert_known_rounding_mode, assert_known_unit

    errors: dict[str, str] = {}
    normalized_type = (response_type or "").strip()
    unit_text = (unit or "").strip()
    mode_text = (rounding_mode or "").strip()
    measurement_set = (
        minimum_value is not None
        or maximum_value is not None
        or unit_text
        or decimal_precision is not None
        or mode_text
    )

    if not normalized_type:
        if require_response_type:
            errors["response_type"] = "Response type is required."
        elif measurement_set:
            errors["response_type"] = (
                "Response type is required when unit or numeric limits are set."
            )
        return errors

    if normalized_type not in ChecklistResponseType.values:
        errors["response_type"] = "Unknown response type."
        return errors

    if normalized_type != ChecklistResponseType.NUMBER:
        if minimum_value is not None or maximum_value is not None:
            errors["minimum_value"] = "Numeric limits are only allowed for NUMBER responses."
        if unit_text:
            errors["unit"] = "Unit is only applicable for NUMBER responses."
        if decimal_precision is not None:
            errors["decimal_precision"] = (
                "decimal_precision is only applicable for NUMBER responses."
            )
        if mode_text:
            errors["rounding_mode"] = "rounding_mode is only applicable for NUMBER responses."
    else:
        if (
            minimum_value is not None
            and maximum_value is not None
            and minimum_value > maximum_value
        ):
            errors["minimum_value"] = "Minimum value cannot be greater than maximum value."
        if unit_text:
            try:
                assert_known_unit(unit_text)
            except ValidationError as exc:
                msg = getattr(exc, "message_dict", None) or {}
                errors["unit"] = msg.get("unit", str(exc))
        if mode_text:
            try:
                assert_known_rounding_mode(mode_text)
            except ValidationError as exc:
                msg = getattr(exc, "message_dict", None) or {}
                errors["rounding_mode"] = msg.get("rounding_mode", str(exc))
        if decimal_precision is not None:
            from apps.checklists.measurement import normalize_decimal_precision

            try:
                normalize_decimal_precision(decimal_precision)
            except ValidationError as exc:
                msg = getattr(exc, "message_dict", None) or {}
                errors["decimal_precision"] = msg.get("decimal_precision", str(exc))

    return errors
