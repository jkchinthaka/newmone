"""Forms for checklist draft recording (including repeating sample rows)."""

from __future__ import annotations

import uuid
from typing import Any

from django import forms

from apps.checklists.models import ChecklistItem, ChecklistItemKind, ChecklistResponseType
from apps.recording.models import ChoiceResponseValue
from apps.recording.repeating import ResponseKey, partition_definition_items


def equipment_field_name(item_id: uuid.UUID, sample_index: int = 1) -> str:
    if sample_index == 1:
        return f"equipment_{item_id.hex}"
    return f"equipment_{item_id.hex}_s{sample_index}"


def response_field_name(item_id: uuid.UUID, sample_index: int = 1) -> str:
    if sample_index == 1:
        # Preserve legacy field names for top-level SIMPLE (sample_index=1).
        return f"response_{item_id.hex}"
    return f"response_{item_id.hex}_s{sample_index}"


def sample_count_field_name(group_id: uuid.UUID) -> str:
    return f"sample_count_{group_id.hex}"


class ChecklistDraftForm(forms.Form):
    """Dynamic draft form — blank answers are allowed for required items."""

    expected_draft_version = forms.IntegerField(
        required=True,
        min_value=1,
        widget=forms.HiddenInput,
    )

    def __init__(
        self,
        *args: Any,
        items: list[ChecklistItem],
        initial_responses: dict[ResponseKey, Any] | None = None,
        sample_indexes_by_group: dict[uuid.UUID, list[int]] | None = None,
        draft_version: int = 1,
        equipment_choices: list[tuple[str, str]] | None = None,
        initial_equipment: dict[ResponseKey, Any] | None = None,
        form_code: str = "",
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self.items = items
        self.form_code = form_code
        self.sample_indexes_by_group = sample_indexes_by_group or {}
        self.equipment_choices = equipment_choices or [("", "— No equipment —")]
        initial_responses = initial_responses or {}
        initial_equipment = initial_equipment or {}
        self.fields["expected_draft_version"].initial = int(draft_version)
        if "expected_draft_version" not in (kwargs.get("data") or {}):
            self.fields["expected_draft_version"].initial = int(draft_version)
        top_simple, groups, children_by_parent, self.top_calculated = partition_definition_items(
            items
        )
        self.top_simple = top_simple
        self.groups = groups
        self.children_by_parent = children_by_parent

        for group in groups:
            count_name = sample_count_field_name(group.id)
            indexes = self.sample_indexes_by_group.get(group.id) or [1]
            self.fields[count_name] = forms.IntegerField(
                required=False,
                min_value=0,
                initial=len(indexes),
                widget=forms.HiddenInput,
            )

        for item in top_simple:
            self._add_item_field(item, sample_index=1, initial_responses=initial_responses)
            self._add_equipment_field(item, sample_index=1, initial_equipment=initial_equipment)

        for group in groups:
            children = children_by_parent.get(group.id, [])
            indexes = self.sample_indexes_by_group.get(group.id) or []
            for sample_index in indexes:
                for child in children:
                    self._add_item_field(
                        child,
                        sample_index=sample_index,
                        initial_responses=initial_responses,
                    )
                    self._add_equipment_field(
                        child,
                        sample_index=sample_index,
                        initial_equipment=initial_equipment,
                    )

    def _add_item_field(
        self,
        item: ChecklistItem,
        *,
        sample_index: int,
        initial_responses: dict[ResponseKey, Any],
    ) -> None:
        if item.item_kind != ChecklistItemKind.SIMPLE:
            return
        name = response_field_name(item.id, sample_index)
        initial = initial_responses.get((item.id, sample_index))
        label = item.label
        if sample_index > 1 or item.parent_item_id is not None:
            label = f"{label} (sample {sample_index})"
        if item.is_required:
            label = f"{label} (required)"

        # aria-required conveys semantic requirement for screen readers even though
        # Django validation uses required=False (incomplete drafts are allowed).
        aria_attrs: dict[str, str] = {"aria-required": "true"} if item.is_required else {}

        yes_label, no_label = self._choice_labels()
        if item.response_type == ChecklistResponseType.YES_NO:
            self.fields[name] = forms.ChoiceField(
                label=label,
                required=False,
                choices=[
                    ("", "— Not answered —"),
                    (ChoiceResponseValue.YES, yes_label),
                    (ChoiceResponseValue.NO, no_label),
                ],
                widget=forms.RadioSelect(attrs={**aria_attrs, "class": "choice-pill__input"}),
                initial=initial or "",
            )
        elif item.response_type == ChecklistResponseType.YES_NO_NA:
            self.fields[name] = forms.ChoiceField(
                label=label,
                required=False,
                choices=[
                    ("", "— Not answered —"),
                    (ChoiceResponseValue.YES, "Yes"),
                    (ChoiceResponseValue.NO, "No"),
                    (ChoiceResponseValue.NA, "N/A"),
                ],
                widget=forms.RadioSelect(attrs={**aria_attrs, "class": "choice-pill__input"}),
                initial=initial or "",
            )
        elif item.response_type == ChecklistResponseType.NUMBER:
            self.fields[name] = forms.DecimalField(
                label=label,
                required=False,
                max_digits=14,
                decimal_places=4,
                widget=forms.NumberInput(
                    attrs={"class": "form-input", "step": "any", **aria_attrs}
                ),
                initial=initial,
            )
        elif item.response_type == ChecklistResponseType.TEXT:
            self.fields[name] = forms.CharField(
                label=label,
                required=False,
                widget=forms.Textarea(attrs={"class": "form-input", "rows": 3, **aria_attrs}),
                initial=initial or "",
            )
        elif item.response_type == ChecklistResponseType.SELECT:
            choices = [("", "— Not answered —")]
            for option in item.options.all():
                choices.append((str(option.id), option.label))
            self.fields[name] = forms.ChoiceField(
                label=label,
                required=False,
                choices=choices,
                widget=forms.Select(attrs={"class": "form-input", **aria_attrs}),
                initial=str(initial) if initial else "",
            )
        else:
            self.fields[name] = forms.CharField(
                label=label,
                required=False,
                disabled=True,
                initial="",
            )

    def _add_equipment_field(
        self,
        item: ChecklistItem,
        *,
        sample_index: int,
        initial_equipment: dict[ResponseKey, Any],
    ) -> None:
        if item.item_kind != ChecklistItemKind.SIMPLE:
            return
        if not bool(getattr(item, "requires_equipment_reference", False)):
            return
        name = equipment_field_name(item.id, sample_index)
        initial = initial_equipment.get((item.id, sample_index))
        self.fields[name] = forms.ChoiceField(
            label=f"Measuring device — {item.code}",
            required=False,
            choices=self.equipment_choices,
            widget=forms.Select(
                attrs={
                    "class": "form-input recording-equipment-select",
                    "data-equipment-hook": "1",
                    "data-device-trace": "1",
                    "aria-label": f"Measuring device for {item.code}",
                }
            ),
            initial=str(initial) if initial else "",
            help_text=(
                "Select/scan measuring device. Status and calibration due appear in the label. "
                "Company WARN/BLOCK policy is settings-driven (default OFF)."
            ),
        )

    def _choice_labels(self) -> tuple[str, str]:
        if self.form_code == "NMS/PPU/CL/24":
            return "Acceptable", "Unacceptable"
        if self.form_code in {"NMS/PPU/CL/30", "NMS/PPU/CL/18"}:
            return "PASS", "FAIL"
        return "Yes", "No"

    def answers_by_item_id(self) -> dict[ResponseKey, Any]:
        """Return answers keyed by ``(item_id, sample_index)``."""
        answers: dict[ResponseKey, Any] = {}
        for item in self.top_simple:
            name = response_field_name(item.id, 1)
            if name in self.fields:
                answers[(item.id, 1)] = self.cleaned_data.get(name)
        for group in self.groups:
            children = self.children_by_parent.get(group.id, [])
            indexes = self.sample_indexes_by_group.get(group.id) or []
            for sample_index in indexes:
                for child in children:
                    name = response_field_name(child.id, sample_index)
                    if name in self.fields:
                        answers[(child.id, sample_index)] = self.cleaned_data.get(name)
        return answers

    def equipment_refs_by_key(self) -> dict[ResponseKey, Any]:
        """Return optional equipment UUIDs for items that require a reference."""
        refs: dict[ResponseKey, Any] = {}
        candidates: list[tuple[ChecklistItem, int]] = [(item, 1) for item in self.top_simple]
        for group in self.groups:
            indexes = self.sample_indexes_by_group.get(group.id) or []
            for sample_index in indexes:
                for child in self.children_by_parent.get(group.id, []):
                    candidates.append((child, sample_index))
        for item, sample_index in candidates:
            name = equipment_field_name(item.id, sample_index)
            if name not in self.fields:
                continue
            raw = self.cleaned_data.get(name)
            refs[(item.id, sample_index)] = raw or None
        return refs
