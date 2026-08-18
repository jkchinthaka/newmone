"""Safe AI assistance orchestration — Phase 18.

Order: authenticate → authorize → feature flag → safety → retrieve → provider → audit.
AI never mutates quality dispositions, specs, roles, CAPA close, or ERP.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError

from apps.core.persistence.transactions import atomic
from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.ai_assistance.anomaly import AdvisoryAnomaly, evaluate_advisory_anomalies
from apps.ai_assistance.catalogue import catalogue_as_dicts
from apps.ai_assistance.models import AIAssistanceRequest, AIAssistanceRequestStatus
from apps.ai_assistance.policy import (
    ai_assistance_enabled,
    ai_timeout_seconds,
    assert_no_prohibited_request,
    parse_use_case,
)
from apps.ai_assistance.providers import get_provider
from apps.ai_assistance.providers.base import LLMProvider, ProviderResult
from apps.ai_assistance.providers.mock import MockLLMProvider
from apps.ai_assistance.retrieval import build_authorized_context
from apps.ai_assistance.safety import SAFE_FALLBACK_MESSAGE, assert_prompt_safe
from apps.organizations.models import Organization
from apps.security_audit.services import record_event

USE_AI = "ai_assistance.use_aiassistance"
VIEW_AUDIT = "ai_assistance.view_aiassistanceaudit"


def _require_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def list_allowed_use_cases(
    *, actor: User | None, organization: Organization
) -> list[dict[str, str]]:
    user = _require_actor(actor)
    require_permission(user, USE_AI, scope=Scope(organization_id=organization.id))
    # Catalogue is visible even when disabled so operators know capability is optional.
    return catalogue_as_dicts()


def run_ai_assistance(
    *,
    actor: User | None,
    organization: Organization,
    use_case: str,
    user_text: str = "",
    params: dict[str, Any] | None = None,
    correlation_id: str = "",
    provider: LLMProvider | None = None,
) -> dict[str, Any]:
    """
    Execute one advisory AI request.

    When disabled, returns a safe disabled payload without calling a provider.
    """
    user = _require_actor(actor)
    require_permission(user, USE_AI, scope=Scope(organization_id=organization.id))
    parsed = parse_use_case(use_case)
    text = (user_text or "").strip()
    corr = (correlation_id or str(uuid.uuid4()))[:64]

    if not ai_assistance_enabled():
        row = AIAssistanceRequest.objects.create(
            organization=organization,
            requested_by=user,
            use_case=parsed.value,
            status=AIAssistanceRequestStatus.DISABLED,
            provider_name="none",
            correlation_id=corr,
            source_ids=[],
            reason_code="AI_DISABLED",
        )
        record_event(
            event_type="AI_ASSISTANCE_DISABLED",
            actor=user,
            metadata={
                "organization_id": str(organization.id),
                "use_case": parsed.value,
                "request_id": str(row.id),
                "correlation_id": corr,
            },
        )
        return {
            "ok": False,
            "status": AIAssistanceRequestStatus.DISABLED,
            "message": (
                "AI assistance is disabled. Core quality recording, review, and QA "
                "workflows continue without AI."
            ),
            "request_id": str(row.id),
            "source_ids": [],
            "anomalies": [],
        }

    try:
        assert_prompt_safe(text)
        assert_no_prohibited_request(text)
        context = build_authorized_context(
            actor=user, organization=organization, use_case=parsed, params=params
        )
    except (ValidationError, PermissionDenied) as exc:
        with atomic():
            row = AIAssistanceRequest.objects.create(
                organization=organization,
                requested_by=user,
                use_case=parsed.value,
                status=AIAssistanceRequestStatus.BLOCKED,
                provider_name="none",
                correlation_id=corr,
                source_ids=[],
                reason_code="SAFETY_OR_AUTH",
            )
            record_event(
                event_type="AI_ASSISTANCE_BLOCKED",
                actor=user,
                metadata={
                    "organization_id": str(organization.id),
                    "use_case": parsed.value,
                    "request_id": str(row.id),
                    "correlation_id": corr,
                    "reason": str(exc)[:200],
                },
            )
        raise

    timeout = ai_timeout_seconds()
    active_provider = provider or get_provider()
    result: ProviderResult = active_provider.generate(
        use_case=parsed.value,
        user_text=text,
        context=context,
        timeout_seconds=timeout,
    )

    anomalies: list[AdvisoryAnomaly] = evaluate_advisory_anomalies(
        counts=context.get("counts") if isinstance(context.get("counts"), dict) else None
    )

    if result.timed_out or result.failed:
        status = AIAssistanceRequestStatus.FALLBACK
        event_type = "AI_ASSISTANCE_FALLBACK"
        message = result.text or SAFE_FALLBACK_MESSAGE
        reason = "TIMEOUT" if result.timed_out else "PROVIDER_FAILURE"
    else:
        status = AIAssistanceRequestStatus.SUCCEEDED
        event_type = "AI_ASSISTANCE_COMPLETED"
        message = result.text
        reason = ""

    row = AIAssistanceRequest.objects.create(
        organization=organization,
        requested_by=user,
        use_case=parsed.value,
        status=status,
        provider_name=result.provider_name,
        correlation_id=corr,
        source_ids=list(result.source_ids or context.get("source_ids") or []),
        reason_code=reason,
    )
    record_event(
        event_type=event_type,
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "use_case": parsed.value,
            "request_id": str(row.id),
            "correlation_id": corr,
            "provider": result.provider_name,
            "status": status,
            "source_id_count": len(row.source_ids),
            # Intentionally omit raw prompt / completion text.
        },
    )
    return {
        "ok": status == AIAssistanceRequestStatus.SUCCEEDED,
        "status": status,
        "message": message,
        "request_id": str(row.id),
        "source_ids": list(row.source_ids),
        "provider": result.provider_name,
        "anomalies": [
            {"code": a.code, "message": a.message, "severity": a.severity} for a in anomalies
        ],
        "advisory_only": True,
    }


def get_mock_provider(*, fail_mode: str = "") -> MockLLMProvider:
    return MockLLMProvider(fail_mode=fail_mode)
