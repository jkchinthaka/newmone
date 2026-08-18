"""Sanitation selectors — scoped reads."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.sanitation.models import ChemicalReference, SanitationProgram, SanitationProgramVersion


def programs_for_organization(organization_id: uuid.UUID) -> QuerySet[SanitationProgram]:
    return SanitationProgram.objects.filter(organization_id=organization_id).select_related(
        "checklist_template", "organization"
    )


def versions_for_program(program_id: uuid.UUID) -> QuerySet[SanitationProgramVersion]:
    return SanitationProgramVersion.objects.filter(program_id=program_id).order_by(
        "-version_number"
    )


def chemicals_for_organization(organization_id: uuid.UUID) -> QuerySet[ChemicalReference]:
    return ChemicalReference.objects.filter(
        organization_id=organization_id, is_active=True
    ).order_by("code")
