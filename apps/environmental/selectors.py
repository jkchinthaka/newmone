"""Environmental monitoring selectors."""

from __future__ import annotations

import uuid
from datetime import datetime

from django.db.models import QuerySet

from apps.environmental.models import (
    MonitoringParameter,
    MonitoringPoint,
    MonitoringReading,
    MonitoringSpec,
    MonitoringTrendIndex,
)


def points_for_organization(organization_id: uuid.UUID) -> QuerySet[MonitoringPoint]:
    return MonitoringPoint.objects.filter(
        organization_id=organization_id, is_active=True
    ).select_related("site", "department")


def parameters_for_organization(
    organization_id: uuid.UUID,
) -> QuerySet[MonitoringParameter]:
    return MonitoringParameter.objects.filter(
        organization_id=organization_id, is_active=True
    ).order_by("code")


def specs_for_organization(organization_id: uuid.UUID) -> QuerySet[MonitoringSpec]:
    return MonitoringSpec.objects.filter(organization_id=organization_id).order_by("code")


def trend_for_point_parameter(
    *,
    organization_id: uuid.UUID,
    monitoring_point_id: uuid.UUID,
    parameter_id: uuid.UUID,
    since: datetime | None = None,
) -> QuerySet[MonitoringTrendIndex]:
    qs = MonitoringTrendIndex.objects.filter(
        organization_id=organization_id,
        monitoring_point_id=monitoring_point_id,
        parameter_id=parameter_id,
    ).order_by("recorded_at")
    if since is not None:
        qs = qs.filter(recorded_at__gte=since)
    return qs


def readings_for_organization(
    organization_id: uuid.UUID,
) -> QuerySet[MonitoringReading]:
    return MonitoringReading.objects.filter(organization_id=organization_id).select_related(
        "monitoring_point", "parameter", "spec_version"
    )
