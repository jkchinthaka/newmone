"""Read helpers for sampling plans."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.sampling.models import SamplingPlan, SamplingPlanVersion, SamplingRule


def plans_for_organization(organization_id: uuid.UUID) -> QuerySet[SamplingPlan]:
    return SamplingPlan.objects.filter(organization_id=organization_id, is_active=True)


def versions_for_plan(plan_id: uuid.UUID) -> QuerySet[SamplingPlanVersion]:
    return SamplingPlanVersion.objects.filter(plan_id=plan_id).order_by("-version_number")


def rules_for_version(plan_version_id: uuid.UUID) -> QuerySet[SamplingRule]:
    return SamplingRule.objects.filter(plan_version_id=plan_version_id).select_related(
        "requirement", "product", "site"
    )
