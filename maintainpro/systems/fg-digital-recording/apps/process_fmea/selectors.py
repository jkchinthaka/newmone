"""Process FMEA selectors — Phase 48."""

from __future__ import annotations

import uuid

from django.core.exceptions import PermissionDenied
from django.db.models import QuerySet

from apps.access_control.services import user_has_permission
from apps.accounts.models import User
from apps.process_fmea.models import (
    FailureMode,
    ProcessFmea,
    ProcessFmeaEvent,
    ProcessFmeaVersion,
    ProcessStep,
)
from apps.process_fmea.services import PERM_VIEW, _scope


def list_process_fmeas(*, actor: User, organization_id: uuid.UUID) -> QuerySet[ProcessFmea]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return ProcessFmea.objects.filter(organization_id=organization_id).order_by("fmea_code")


def get_process_fmea_for_org(
    *, actor: User, organization_id: uuid.UUID, fmea_id: uuid.UUID
) -> ProcessFmea:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return ProcessFmea.objects.get(pk=fmea_id, organization_id=organization_id)


def list_fmea_versions(*, fmea: ProcessFmea) -> QuerySet[ProcessFmeaVersion]:
    return fmea.versions.all().order_by("-version_number")


def list_process_steps(*, version: ProcessFmeaVersion) -> QuerySet[ProcessStep]:
    return version.process_steps.all()


def list_failure_modes(*, version: ProcessFmeaVersion) -> QuerySet[FailureMode]:
    return FailureMode.objects.filter(process_step__version=version).select_related("process_step")


def list_fmea_events(*, fmea: ProcessFmea) -> QuerySet[ProcessFmeaEvent]:
    return fmea.events.all()
