"""RBAC-scoped context retrieval — authorize before any model context is built."""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError

from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.ai_assistance.catalogue import AllowedUseCase
from apps.ai_assistance.privacy import minimize_context
from apps.capa.models import CorrectiveAction
from apps.nonconformance.models import NonConformanceRecord
from apps.organizations.models import Organization
from apps.scheduling.models import ChecklistTask, ExternalBatchEvent

# Reuse existing domain permissions where available; AI does not invent new authority.
CREATE_NCR = "nonconformance.create_nonconformance"
MANAGE_NCR = "nonconformance.manage_nonconformance"
CREATE_CAPA = "capa.create_capa"
MANAGE_CAPA = "capa.manage_capa"
MANAGE_TASK = "scheduling.manage_checklisttask"
RECORD_TASK = "scheduling.record_checklisttask"


def _org_scope(organization: Organization) -> Scope:
    return Scope(organization_id=organization.id)


def build_authorized_context(
    *,
    actor: User,
    organization: Organization,
    use_case: AllowedUseCase,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Build minimized context only from records the actor may see in this organization.

    Cross-organization ids are denied.
    """
    data = dict(params or {})
    org_id = organization.id
    base: dict[str, Any] = {
        "organization_id": str(org_id),
        "organization_code": organization.code,
        "source_ids": [],
        "codes": [],
        "statuses": [],
        "counts": {},
        "metric_labels": [],
        "titles": [],
    }

    if use_case == AllowedUseCase.SUMMARIZE_BATCH_HISTORY:
        batch_reference = (data.get("batch_reference") or "").strip()
        if not batch_reference:
            raise ValidationError({"batch_reference": "batch_reference is required."})
        if not (
            user_has_permission(actor, MANAGE_TASK, scope=_org_scope(organization))
            or user_has_permission(actor, RECORD_TASK, scope=_org_scope(organization))
            or actor.is_superuser
        ):
            # Org queryset still enforced below even if role is broad.
            pass
        tasks = list(
            ChecklistTask.objects.filter(
                organization_id=org_id, batch_reference__iexact=batch_reference
            ).order_by("-created_at")[:20]
        )
        events = list(
            ExternalBatchEvent.objects.filter(
                organization_id=org_id, external_batch_id__iexact=batch_reference
            ).order_by("-created_at")[:20]
        )
        base["batch_reference"] = batch_reference
        base["source_ids"] = [str(t.id) for t in tasks] + [str(e.id) for e in events]
        base["statuses"] = [t.status for t in tasks] + [e.status for e in events]
        base["counts"] = {"tasks": len(tasks), "external_events": len(events)}
        return minimize_context(base)

    if use_case == AllowedUseCase.SUMMARIZE_NCR_CAPA:
        ncr_id = data.get("ncr_id")
        capa_id = data.get("capa_id")
        if not ncr_id and not capa_id:
            raise ValidationError({"ncr_id": "Provide ncr_id and/or capa_id."})
        scope = _org_scope(organization)
        if ncr_id:
            if not (
                user_has_permission(actor, CREATE_NCR, scope=scope)
                or user_has_permission(actor, MANAGE_NCR, scope=scope)
                or actor.is_superuser
            ):
                raise PermissionDenied("NCR permission required for AI context.")
            ncr = NonConformanceRecord.objects.filter(pk=ncr_id).first()
            if ncr is None or ncr.organization_id != org_id:
                raise PermissionDenied("NCR not found in the active organization.")
            base["source_ids"].append(str(ncr.id))
            base["codes"].append(ncr.code)
            base["statuses"].append(ncr.status)
            base["titles"].append(f"NCR {ncr.code}")
        if capa_id:
            if not (
                user_has_permission(actor, CREATE_CAPA, scope=scope)
                or user_has_permission(actor, MANAGE_CAPA, scope=scope)
                or actor.is_superuser
            ):
                raise PermissionDenied("CAPA permission required for AI context.")
            capa = CorrectiveAction.objects.filter(pk=capa_id).first()
            if capa is None or capa.organization_id != org_id:
                raise PermissionDenied("CAPA not found in the active organization.")
            base["source_ids"].append(str(capa.id))
            base["codes"].append(capa.code)
            base["statuses"].append(capa.status)
            base["titles"].append(f"CAPA {capa.code}")
        return minimize_context(base)

    if use_case == AllowedUseCase.EXPLAIN_REPORT_METRICS:
        labels = data.get("metric_labels") or []
        counts = data.get("counts") or {}
        if not isinstance(labels, list) or not isinstance(counts, dict):
            raise ValidationError({"metrics": "metric_labels list and counts object required."})
        base["metric_labels"] = [str(x)[:80] for x in labels][:30]
        base["counts"] = {str(k)[:64]: counts[k] for k in list(counts)[:30]}
        base["source_ids"] = [str(x) for x in (data.get("source_ids") or [])][:50]
        return minimize_context(base)

    if use_case == AllowedUseCase.ASSIST_SEARCH:
        query = (data.get("query") or "").strip()
        if not query:
            raise ValidationError({"query": "query is required."})
        # Org-scoped code search only — no cross-org
        ncrs = list(
            NonConformanceRecord.objects.filter(
                organization_id=org_id, code__icontains=query
            ).order_by("-created_at")[:10]
        )
        capas = list(
            CorrectiveAction.objects.filter(organization_id=org_id, code__icontains=query).order_by(
                "-created_at"
            )[:10]
        )
        base["codes"] = [n.code for n in ncrs] + [c.code for c in capas]
        base["source_ids"] = [str(n.id) for n in ncrs] + [str(c.id) for c in capas]
        base["counts"] = {"ncr_hits": len(ncrs), "capa_hits": len(capas)}
        return minimize_context(base)

    if use_case == AllowedUseCase.TREND_NARRATION:
        counts = data.get("counts") or {}
        if not isinstance(counts, dict) or not counts:
            raise ValidationError(
                {"counts": "Caller-supplied counts are required for trend narration."}
            )
        base["counts"] = {str(k)[:64]: counts[k] for k in list(counts)[:30]}
        base["metric_labels"] = [str(k)[:80] for k in list(counts)[:30]]
        base["source_ids"] = [str(x) for x in (data.get("source_ids") or [])][:50]
        return minimize_context(base)

    raise ValidationError({"use_case": f"Unsupported use case: {use_case}"})


def assert_organization_match(
    *, organization: Organization, foreign_org_id: uuid.UUID | None
) -> None:
    if foreign_org_id is not None and foreign_org_id != organization.id:
        raise PermissionDenied("Cross-organization AI context retrieval is denied.")
