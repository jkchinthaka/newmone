"""Supplier quality services — ERP-referenced profiles; no financial supplier master."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from apps.core.persistence import atomic_fn, lock_queryset, locked_get
from django.utils import timezone

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.nonconformance.models import NonConformanceRecord
from apps.organizations.models import Organization
from apps.organizations.services import normalize_name
from apps.security_audit.services import record_event
from apps.supplier_quality.models import (
    SupplierCertificate,
    SupplierQualityEvent,
    SupplierQualityEventKind,
    SupplierQualityProfile,
)

MANAGE_SUPPLIER_QUALITY_QA = "supplier_quality.manage_supplierquality_qa"
VIEW_SUPPLIER_QUALITY_PROCUREMENT = "supplier_quality.view_supplierquality_procurement"
VIEW_SUPPLIER_QUALITY_PROFILE = "supplier_quality.view_supplierqualityprofile"


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _normalize_erp_ref(raw: str) -> str:
    return (raw or "").strip()


def assert_can_manage_qa(*, actor: User, organization_id: uuid.UUID) -> None:
    require_permission(
        actor, MANAGE_SUPPLIER_QUALITY_QA, scope=Scope(organization_id=organization_id)
    )


def assert_can_view_supplier_quality(*, actor: User, organization_id: uuid.UUID) -> None:
    scope = Scope(organization_id=organization_id)
    if user_has_permission(actor, MANAGE_SUPPLIER_QUALITY_QA, scope=scope):
        return
    if user_has_permission(actor, VIEW_SUPPLIER_QUALITY_PROCUREMENT, scope=scope):
        return
    if user_has_permission(actor, VIEW_SUPPLIER_QUALITY_PROFILE, scope=scope):
        return
    raise PermissionDenied("Supplier quality view permission required.")


def certificate_is_expired(cert: SupplierCertificate, *, as_of: date | None = None) -> bool:
    if cert.expires_on is None:
        return False
    day = as_of or timezone.localdate()
    return cert.expires_on < day


@atomic_fn
def create_supplier_quality_profile(
    *,
    actor: User | None,
    organization: Organization,
    erp_supplier_reference: str,
    display_name: str = "",
    quality_status: str = "",
    notes: str = "",
    is_active: bool = True,
) -> SupplierQualityProfile:
    user = _require_authenticated_actor(actor)
    assert_can_manage_qa(actor=user, organization_id=organization.id)
    ref = _normalize_erp_ref(erp_supplier_reference)
    if not ref:
        raise ValidationError({"erp_supplier_reference": "ERP supplier reference cannot be blank."})
    profile = SupplierQualityProfile(
        organization=organization,
        erp_supplier_reference=ref,
        display_name=normalize_name(display_name) if display_name else "",
        quality_status=(quality_status or "").strip(),
        notes=(notes or "").strip(),
        is_active=is_active,
    )
    try:
        profile.full_clean()
        profile.save()
    except (ValidationError, IntegrityError) as exc:
        if isinstance(exc, IntegrityError) or "unique" in str(exc).lower():
            raise ValidationError(
                {
                    "erp_supplier_reference": (
                        "A quality profile for this ERP supplier reference already exists "
                        "in the organization."
                    )
                }
            ) from exc
        raise
    record_event(
        event_type="SUPPLIER_QUALITY_PROFILE_CREATED",
        actor=user,
        metadata={
            "profile_id": str(profile.id),
            "organization_id": str(organization.id),
            "erp_supplier_reference": profile.erp_supplier_reference,
        },
    )
    return profile


@atomic_fn
def update_supplier_quality_profile(
    *,
    actor: User | None,
    profile_id: uuid.UUID,
    display_name: str | None = None,
    quality_status: str | None = None,
    notes: str | None = None,
    is_active: bool | None = None,
) -> SupplierQualityProfile:
    user = _require_authenticated_actor(actor)
    profile = locked_get(SupplierQualityProfile, pk=profile_id)
    if profile is None:
        raise ValidationError({"profile": "Supplier quality profile not found."})
    assert_can_manage_qa(actor=user, organization_id=profile.organization_id)
    changed: list[str] = []
    if display_name is not None:
        profile.display_name = normalize_name(display_name) if display_name else ""
        changed.append("display_name")
    if quality_status is not None:
        profile.quality_status = quality_status.strip()
        changed.append("quality_status")
    if notes is not None:
        profile.notes = notes.strip()
        changed.append("notes")
    if is_active is not None:
        profile.is_active = is_active
        changed.append("is_active")
    profile.full_clean()
    profile.save()
    record_event(
        event_type="SUPPLIER_QUALITY_PROFILE_UPDATED",
        actor=user,
        metadata={
            "profile_id": str(profile.id),
            "organization_id": str(profile.organization_id),
            "changed_fields": changed,
        },
    )
    return profile


@atomic_fn
def add_supplier_certificate(
    *,
    actor: User | None,
    profile_id: uuid.UUID,
    certificate_type: str,
    issued_on: date | None = None,
    expires_on: date | None = None,
    evidence_object_key: str = "",
) -> SupplierCertificate:
    user = _require_authenticated_actor(actor)
    profile = SupplierQualityProfile.objects.filter(pk=profile_id).first()
    if profile is None:
        raise ValidationError({"profile": "Supplier quality profile not found."})
    assert_can_manage_qa(actor=user, organization_id=profile.organization_id)
    cert_type = (certificate_type or "").strip()
    if not cert_type:
        raise ValidationError({"certificate_type": "Certificate type cannot be blank."})
    cert = SupplierCertificate(
        profile=profile,
        certificate_type=cert_type,
        issued_on=issued_on,
        expires_on=expires_on,
        evidence_object_key=(evidence_object_key or "").strip(),
    )
    cert.full_clean()
    cert.save()
    record_event(
        event_type="SUPPLIER_CERTIFICATE_RECORDED",
        actor=user,
        metadata={
            "certificate_id": str(cert.id),
            "profile_id": str(profile.id),
            "organization_id": str(profile.organization_id),
            "certificate_type": cert.certificate_type,
            "expires_on": str(expires_on) if expires_on else None,
        },
    )
    return cert


@atomic_fn
def verify_supplier_certificate(
    *,
    actor: User | None,
    certificate_id: uuid.UUID,
    verification_note: str = "",
) -> SupplierCertificate:
    user = _require_authenticated_actor(actor)
    cert = (
        lock_queryset(
        SupplierCertificate.objects.select_related("profile").filter(pk=certificate_id)
        ).first()
    )
    if cert is None:
        raise ValidationError({"certificate": "Supplier certificate not found."})
    assert_can_manage_qa(actor=user, organization_id=cert.profile.organization_id)
    cert.verified_at = timezone.now()
    cert.verified_by = user
    cert.verification_note = (verification_note or "").strip()
    cert.full_clean()
    cert.save(update_fields=["verified_at", "verified_by", "verification_note", "updated_at"])
    record_event(
        event_type="SUPPLIER_CERTIFICATE_VERIFIED",
        actor=user,
        metadata={
            "certificate_id": str(cert.id),
            "profile_id": str(cert.profile_id),
            "organization_id": str(cert.profile.organization_id),
        },
    )
    return cert


@atomic_fn
def record_supplier_quality_event(
    *,
    actor: User | None,
    profile_id: uuid.UUID,
    event_kind: str,
    occurred_at: datetime,
    summary: str,
    nonconformance_id: uuid.UUID | None = None,
    corrective_action_id: uuid.UUID | None = None,
) -> SupplierQualityEvent:
    user = _require_authenticated_actor(actor)
    profile = SupplierQualityProfile.objects.filter(pk=profile_id).first()
    if profile is None:
        raise ValidationError({"profile": "Supplier quality profile not found."})
    assert_can_manage_qa(actor=user, organization_id=profile.organization_id)
    kind = (event_kind or "").strip().upper()
    if kind not in SupplierQualityEventKind.values:
        raise ValidationError({"event_kind": "Unknown quality event kind."})
    ncr: NonConformanceRecord | None = None
    if nonconformance_id is not None:
        ncr = NonConformanceRecord.objects.filter(
            pk=nonconformance_id, organization_id=profile.organization_id
        ).first()
        if ncr is None:
            raise ValidationError({"nonconformance": "Nonconformance not found in organization."})
    capa: CorrectiveAction | None = None
    if corrective_action_id is not None:
        capa = CorrectiveAction.objects.filter(
            pk=corrective_action_id, organization_id=profile.organization_id
        ).first()
        if capa is None:
            raise ValidationError(
                {"corrective_action": "Corrective action not found in organization."}
            )
    event = SupplierQualityEvent(
        profile=profile,
        event_kind=kind,
        occurred_at=occurred_at,
        summary=(summary or "").strip(),
        nonconformance=ncr,
        corrective_action=capa,
        recorded_by=user,
    )
    event.full_clean()
    event.save()
    record_event(
        event_type="SUPPLIER_QUALITY_EVENT_RECORDED",
        actor=user,
        metadata={
            "event_id": str(event.id),
            "profile_id": str(profile.id),
            "organization_id": str(profile.organization_id),
            "event_kind": event.event_kind,
            "nonconformance_id": str(ncr.id) if ncr else None,
            "capa_id": str(capa.id) if capa else None,
        },
    )
    return event


def build_supplier_quality_metrics(
    *,
    actor: User | None,
    profile_id: uuid.UUID,
    as_of: date | None = None,
) -> dict[str, Any]:
    """
    Derive count-only metrics from persisted records.

    No invented score, grade, or pass/fail threshold.
    """
    user = _require_authenticated_actor(actor)
    profile = SupplierQualityProfile.objects.filter(pk=profile_id).first()
    if profile is None:
        raise ValidationError({"profile": "Supplier quality profile not found."})
    assert_can_view_supplier_quality(actor=user, organization_id=profile.organization_id)
    day = as_of or timezone.localdate()
    certificates = list(SupplierCertificate.objects.filter(profile_id=profile.id))
    events = SupplierQualityEvent.objects.filter(profile_id=profile.id)
    return {
        "profile_id": str(profile.id),
        "organization_id": str(profile.organization_id),
        "erp_supplier_reference": profile.erp_supplier_reference,
        "as_of": str(day),
        "certificate_count": len(certificates),
        "expired_certificate_count": sum(
            1 for c in certificates if certificate_is_expired(c, as_of=day)
        ),
        "verified_certificate_count": sum(1 for c in certificates if c.verified_at is not None),
        "quality_event_count": events.count(),
        "incoming_defect_count": events.filter(
            event_kind=SupplierQualityEventKind.INCOMING_DEFECT
        ).count(),
        "linked_open_ncr_count": events.filter(
            nonconformance__isnull=False, nonconformance__status="OPEN"
        )
        .values("nonconformance_id")
        .distinct()
        .count(),
        "linked_open_capa_count": events.filter(
            corrective_action__isnull=False, corrective_action__status="OPEN"
        )
        .values("corrective_action_id")
        .distinct()
        .count(),
        # Explicit: no composite score field is computed or returned.
    }
