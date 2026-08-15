"""Publish SOURCE RECEIVED controlled-form templates into a DEMO/TEST org only."""

from __future__ import annotations

import uuid
from decimal import Decimal

from django.core.exceptions import ValidationError

from apps.accounts.models import User
from apps.checklists.controlled_forms import (
    COLD_ROOM_SLOT_LABELS,
    COLD_ROOM_TEMP_MAX,
    COLD_ROOM_TEMP_MIN,
    CONTROLLED_FORMS,
    DISPATCH_SAMPLE_COUNT,
    DISPATCH_TEMP_MAX,
    DISPATCH_TEMP_MIN,
)
from apps.checklists.models import (
    ChecklistEvaluationRuleKind,
    ChecklistResponseType,
    ChecklistTemplate,
)
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
    set_checklist_item_evaluation_rule,
)
from apps.organizations.models import Organization
from apps.recording.synthetic_demo import demo_environment_allowed


def _numeric_band(*, actor: User, item_id: uuid.UUID, lo: Decimal, hi: Decimal) -> None:
    set_checklist_item_evaluation_rule(
        actor=actor,
        item_id=item_id,
        rule_kind=ChecklistEvaluationRuleKind.NUMERIC_BOUNDS,
        bound_min=lo,
        bound_max=hi,
        min_inclusive=True,
        max_inclusive=True,
    )


def seed_controlled_form_templates(*, actor: User, organization: Organization) -> None:
    if not demo_environment_allowed():
        raise ValidationError({"environment": "Controlled-form demo seed is blocked."})
    for spec in CONTROLLED_FORMS:
        existing = ChecklistTemplate.objects.filter(
            organization=organization, code=spec.code
        ).first()
        if existing is not None:
            continue
        template = create_checklist_template(
            actor=actor,
            organization=organization,
            code=spec.code,
            name=f"{spec.title} (SOURCE RECEIVED — not business approved)",
        )
        version = create_checklist_version(actor=actor, template_id=template.id)
        if spec.code == "NMS/PPU/CL/24":
            fg = add_checklist_section(
                actor=actor, version_id=version.id, title="04 Finish Good Section"
            )
            for code, label in (
                ("FG-WALL", "4.1 Wall — Acceptable / Unacceptable"),
                ("FG-FLOOR", "4.2 Floor — Acceptable / Unacceptable"),
                ("FG-DRAIN", "4.3 Drainage Line — Acceptable / Unacceptable"),
                ("FG-FOOT", "4.4 Foot Bath — Acceptable / Unacceptable"),
                ("FG-WM1", "4.5 Weighing Machine 1 — Acceptable / Unacceptable"),
                ("FG-WM2", "4.6 Weighing Machine 2 — Acceptable / Unacceptable"),
                ("FG-CR1", "4.7 Cold Room 1 — Acceptable / Unacceptable"),
                ("FG-CR2", "4.8 Cold Room 2 — Acceptable / Unacceptable"),
            ):
                add_checklist_item(
                    actor=actor,
                    section_id=fg.id,
                    code=code,
                    label=label,
                    response_type=ChecklistResponseType.YES_NO,
                    is_required=True,
                )
            chg = add_checklist_section(
                actor=actor, version_id=version.id, title="05 Changing Room"
            )
            for code, label in (
                ("CH-WALL", "5.1 Wall — Acceptable / Unacceptable"),
                ("CH-FLOOR", "5.2 Floor — Acceptable / Unacceptable"),
                ("CH-LOCKER", "5.3 Locker — Acceptable / Unacceptable"),
            ):
                add_checklist_item(
                    actor=actor,
                    section_id=chg.id,
                    code=code,
                    label=label,
                    response_type=ChecklistResponseType.YES_NO,
                    is_required=True,
                )
            notes = add_checklist_section(
                actor=actor, version_id=version.id, title="Correction / action"
            )
            add_checklist_item(
                actor=actor,
                section_id=notes.id,
                code="CORR",
                label="Correction",
                response_type=ChecklistResponseType.TEXT,
                is_required=False,
            )
            add_checklist_item(
                actor=actor,
                section_id=notes.id,
                code="CA",
                label="Corrective Action",
                response_type=ChecklistResponseType.TEXT,
                is_required=False,
            )
        elif spec.code == "NMS/PPU/CL/39":
            for slot_index, slot in enumerate(COLD_ROOM_SLOT_LABELS, start=1):
                section = add_checklist_section(actor=actor, version_id=version.id, title=slot)
                for pos in ("Up", "Middle", "Down"):
                    item = add_checklist_item(
                        actor=actor,
                        section_id=section.id,
                        code=f"SLOT{slot_index}-{pos[0]}",
                        label=f"{slot} {pos} core temperature °C",
                        response_type=ChecklistResponseType.NUMBER,
                        unit="°C",
                        is_required=True,
                    )
                    _numeric_band(
                        actor=actor,
                        item_id=item.id,
                        lo=COLD_ROOM_TEMP_MIN,
                        hi=COLD_ROOM_TEMP_MAX,
                    )
            remarks = add_checklist_section(actor=actor, version_id=version.id, title="Remarks")
            add_checklist_item(
                actor=actor,
                section_id=remarks.id,
                code="REMARKS",
                label="Remarks",
                response_type=ChecklistResponseType.TEXT,
                is_required=False,
            )
        elif spec.code == "NMS/PPU/CL/30":
            ctx = add_checklist_section(actor=actor, version_id=version.id, title="Freezer truck")
            add_checklist_item(
                actor=actor,
                section_id=ctx.id,
                code="VEHICLE",
                label="Freezer truck no. / vehicle number",
                response_type=ChecklistResponseType.TEXT,
                is_required=True,
            )
            add_checklist_item(
                actor=actor,
                section_id=ctx.id,
                code="TIME",
                label="Inspection time",
                response_type=ChecklistResponseType.TEXT,
                is_required=True,
            )
            cond = add_checklist_section(
                actor=actor, version_id=version.id, title="Condition checks"
            )
            for code, label in (
                ("CLEAN", "Cleanliness of freezer truck — PASS / FAIL"),
                ("PELLETS", "Pellets — PASS / FAIL"),
                ("FLOOR", "Floor — PASS / FAIL"),
                ("WALL", "Side wall — PASS / FAIL"),
                ("CURTAIN", "Curtains — PASS / FAIL"),
                ("LOCK", "Door lock — PASS / FAIL"),
                ("INSECT", "Presence of insects or any sign — PASS / FAIL"),
            ):
                add_checklist_item(
                    actor=actor,
                    section_id=cond.id,
                    code=code,
                    label=label,
                    response_type=ChecklistResponseType.YES_NO,
                    is_required=True,
                )
            act = add_checklist_section(
                actor=actor, version_id=version.id, title="Corrective action"
            )
            add_checklist_item(
                actor=actor,
                section_id=act.id,
                code="CA",
                label="Corrective Action",
                response_type=ChecklistResponseType.TEXT,
                is_required=False,
            )
        elif spec.code == "NMS/PPU/CL/18":
            hdr = add_checklist_section(
                actor=actor, version_id=version.id, title="Dispatch context"
            )
            for code, label, required in (
                ("VEHICLE", "Vehicle No.", True),
                ("GIN", "GIN No.", True),
                ("CLEAN", "Cleanliness of freezer truck — PASS / FAIL", True),
                ("CURTAIN", "Pellets / Curtains — PASS / FAIL", True),
            ):
                add_checklist_item(
                    actor=actor,
                    section_id=hdr.id,
                    code=code,
                    label=label,
                    response_type=(
                        ChecklistResponseType.YES_NO
                        if code in {"CLEAN", "CURTAIN"}
                        else ChecklistResponseType.TEXT
                    ),
                    is_required=required,
                )
            samples = add_checklist_section(
                actor=actor,
                version_id=version.id,
                title="Sample temperatures 1–10 (procedure: ten bulk bags)",
            )
            for index in range(1, DISPATCH_SAMPLE_COUNT + 1):
                item = add_checklist_item(
                    actor=actor,
                    section_id=samples.id,
                    code=f"T{index:02d}",
                    label=f"Sample {index} temperature °C",
                    response_type=ChecklistResponseType.NUMBER,
                    unit="°C",
                    is_required=True,
                )
                _numeric_band(
                    actor=actor,
                    item_id=item.id,
                    lo=DISPATCH_TEMP_MIN,
                    hi=DISPATCH_TEMP_MAX,
                )
            notes = add_checklist_section(
                actor=actor, version_id=version.id, title="Remarks / correction"
            )
            add_checklist_item(
                actor=actor,
                section_id=notes.id,
                code="REMARKS",
                label="Remarks",
                response_type=ChecklistResponseType.TEXT,
                is_required=False,
            )
            add_checklist_item(
                actor=actor,
                section_id=notes.id,
                code="CORR",
                label="Correction",
                response_type=ChecklistResponseType.TEXT,
                is_required=False,
            )
            add_checklist_item(
                actor=actor,
                section_id=notes.id,
                code="CA",
                label="Corrective Action",
                response_type=ChecklistResponseType.TEXT,
                is_required=False,
            )
        publish_checklist_version(actor=actor, version_id=version.id)
