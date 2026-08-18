"""RCA operator views — thin HTTP adapters over Phase 49 services."""

from __future__ import annotations

import uuid
from typing import cast

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Paginator
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.access_control.services import user_has_permission
from apps.accounts.models import User
from apps.rca.forms import (
    RcaCapaLinkForm,
    RcaCauseForm,
    RcaConfirmForm,
    RcaCreateForm,
    RcaEvidenceForm,
    RcaFishboneForm,
    RcaFiveWhyForm,
    RcaParticipantForm,
    RcaSupportForm,
    RcaVerifyForm,
)
from apps.rca.models import RcaCauseState, RcaSourceKind, RcaStatus, RootCauseAnalysis
from apps.rca.selectors import (
    actor_can_access_rca_module,
    get_rca_for_org,
    list_rca_causes,
    list_rca_events,
    list_rcas_for_actor,
    organizations_for_rca_manage,
)
from apps.rca.services import (
    PERM_CAPA,
    PERM_CONFIRM,
    PERM_MANAGE,
    _scope,
    add_fishbone_entry,
    add_five_why_step,
    add_possible_cause,
    add_rca_evidence,
    add_rca_participant,
    cancel_rca,
    close_rca,
    confirm_root_cause,
    create_rca,
    link_confirmed_cause_to_capa,
    mark_cause_supported,
    record_rca_verification,
    start_rca,
)

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


def _require_rca_module(request: HttpRequest) -> None:
    if not actor_can_access_rca_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _validation_message(exc: ValidationError) -> str:
    if hasattr(exc, "message_dict"):
        parts: list[str] = []
        for msgs in exc.message_dict.values():
            parts.extend(str(m) for m in msgs)
        return "; ".join(parts)
    return "; ".join(str(m) for m in exc.messages)


def _load_rca(request: HttpRequest, rca_id: uuid.UUID) -> RootCauseAnalysis:
    actor = _actor(request)
    try:
        rca = get_rca_for_org(
            actor=actor,
            organization_id=_org_id_for_rca(actor, rca_id),
            rca_id=rca_id,
        )
    except Exception as exc:
        raise Http404("RCA not found.") from exc
    return rca


def _org_id_for_rca(actor: User, rca_id: uuid.UUID) -> uuid.UUID:
    from apps.rca.models import RootCauseAnalysis

    rca = RootCauseAnalysis.objects.filter(pk=rca_id).first()
    if rca is None:
        raise Http404("RCA not found.")
    get_rca_for_org(actor=actor, organization_id=rca.organization_id, rca_id=rca_id)
    return rca.organization_id


@login_required
@require_GET
def rca_list(request: HttpRequest) -> HttpResponse:
    _require_rca_module(request)
    status = (request.GET.get("status") or "").strip()
    if status and status not in RcaStatus.values:
        status = ""
    rows = list_rcas_for_actor(actor=_actor(request), status=status or None)
    page = Paginator(rows, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return render(
        request,
        "rca/list.html",
        {
            "page_title": "Root cause analysis",
            "page": page,
            "status": status,
            "status_choices": RcaStatus.choices,
            "can_manage": organizations_for_rca_manage(_actor(request)).exists(),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
def rca_create(request: HttpRequest) -> HttpResponse:
    _require_rca_module(request)
    orgs = organizations_for_rca_manage(_actor(request))
    if not orgs.exists():
        raise PermissionDenied("Permission denied.")
    form = RcaCreateForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        org_id = form.cleaned_data["organization_id"]
        if not orgs.filter(pk=org_id).exists():
            raise PermissionDenied("Permission denied.")
        try:
            rca = create_rca(
                actor=_actor(request),
                organization_id=org_id,
                rca_code=form.cleaned_data["rca_code"],
                source_kind=form.cleaned_data["source_kind"],
                source_citation=form.cleaned_data.get("source_citation") or "",
                containment_reference=form.cleaned_data.get("containment_reference") or "",
                linked_object_id=form.cleaned_data.get("linked_object_id"),
                problem_statement=form.cleaned_data["problem_statement"],
                facilitator_reference=form.cleaned_data.get("facilitator_reference") or "",
            )
        except ValidationError as exc:
            messages.error(request, _validation_message(exc))
        else:
            messages.success(request, "RCA record created. No root cause is confirmed.")
            return redirect("rca:detail", rca_id=rca.id)
    return render(
        request,
        "rca/create.html",
        {
            "page_title": "Create RCA",
            "form": form,
            "organizations": orgs,
            "source_kinds": RcaSourceKind.choices,
        },
    )


@login_required
@require_GET
def rca_detail(request: HttpRequest, rca_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    rca = _load_rca(request, rca_id)
    actor = _actor(request)
    org_id = rca.organization_id
    return render(
        request,
        "rca/detail.html",
        {
            "page_title": f"RCA {rca.rca_code}",
            "rca": rca,
            "causes": list_rca_causes(rca=rca),
            "events": list_rca_events(rca=rca),
            "participants": rca.participants.select_related("participant").all(),
            "five_why_steps": rca.five_why_steps.all(),
            "fishbone_entries": rca.fishbone_entries.all(),
            "can_manage": user_has_permission(actor, PERM_MANAGE, scope=_scope(org_id)),
            "can_confirm": user_has_permission(actor, PERM_CONFIRM, scope=_scope(org_id)),
            "can_link_capa": user_has_permission(actor, PERM_CAPA, scope=_scope(org_id)),
            "cause_states": RcaCauseState,
        },
    )


@login_required
@require_POST
def rca_start(request: HttpRequest, rca_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    try:
        start_rca(actor=_actor(request), rca_id=rca_id)
    except (PermissionDenied, ValidationError) as exc:
        if isinstance(exc, PermissionDenied):
            raise
        messages.error(request, _validation_message(exc))
    else:
        messages.success(request, "RCA investigation started.")
    return redirect("rca:detail", rca_id=rca_id)


@login_required
@require_POST
def rca_add_participant(request: HttpRequest, rca_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    form = RcaParticipantForm(request.POST)
    if form.is_valid():
        try:
            add_rca_participant(
                actor=_actor(request),
                rca_id=rca_id,
                name_reference=form.cleaned_data["name_reference"],
                role_note=form.cleaned_data.get("role_note") or "",
            )
        except (PermissionDenied, ValidationError) as exc:
            if isinstance(exc, PermissionDenied):
                raise
            messages.error(request, _validation_message(exc))
        else:
            messages.success(request, "Participant recorded.")
    return redirect("rca:detail", rca_id=rca_id)


@login_required
@require_POST
def rca_add_five_why(request: HttpRequest, rca_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    form = RcaFiveWhyForm(request.POST)
    if form.is_valid():
        try:
            add_five_why_step(
                actor=_actor(request),
                rca_id=rca_id,
                sequence=form.cleaned_data["sequence"],
                why_question=form.cleaned_data["why_question"],
                answer=form.cleaned_data["answer"],
            )
        except (PermissionDenied, ValidationError) as exc:
            if isinstance(exc, PermissionDenied):
                raise
            messages.error(request, _validation_message(exc))
        else:
            messages.success(request, "Optional 5 Why step recorded.")
    return redirect("rca:detail", rca_id=rca_id)


@login_required
@require_POST
def rca_add_fishbone(request: HttpRequest, rca_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    form = RcaFishboneForm(request.POST)
    if form.is_valid():
        try:
            add_fishbone_entry(
                actor=_actor(request),
                rca_id=rca_id,
                category=form.cleaned_data["category"],
                description=form.cleaned_data["description"],
                category_label=form.cleaned_data.get("category_label") or "",
            )
        except (PermissionDenied, ValidationError) as exc:
            if isinstance(exc, PermissionDenied):
                raise
            messages.error(request, _validation_message(exc))
        else:
            messages.success(request, "Optional fishbone entry recorded.")
    return redirect("rca:detail", rca_id=rca_id)


@login_required
@require_POST
def rca_add_cause(request: HttpRequest, rca_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    form = RcaCauseForm(request.POST)
    if form.is_valid():
        try:
            add_possible_cause(
                actor=_actor(request),
                rca_id=rca_id,
                statement=form.cleaned_data["statement"],
                evidence_citation=form.cleaned_data.get("evidence_citation") or "",
            )
        except (PermissionDenied, ValidationError) as exc:
            if isinstance(exc, PermissionDenied):
                raise
            messages.error(request, _validation_message(exc))
        else:
            messages.success(request, "Possible cause recorded. Not confirmed.")
    return redirect("rca:detail", rca_id=rca_id)


@login_required
@require_POST
def rca_add_evidence(request: HttpRequest, rca_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    form = RcaEvidenceForm(request.POST)
    if form.is_valid():
        try:
            add_rca_evidence(
                actor=_actor(request),
                rca_id=rca_id,
                citation=form.cleaned_data.get("citation") or "",
                cause_id=form.cleaned_data.get("cause_id"),
            )
        except (PermissionDenied, ValidationError) as exc:
            if isinstance(exc, PermissionDenied):
                raise
            messages.error(request, _validation_message(exc))
        else:
            messages.success(request, "Evidence citation recorded.")
    return redirect("rca:detail", rca_id=rca_id)


@login_required
@require_POST
def rca_support_cause(request: HttpRequest, cause_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    form = RcaSupportForm(request.POST)
    from apps.rca.models import RcaCause

    cause = RcaCause.objects.select_related("rca").filter(pk=cause_id).first()
    if cause is None:
        raise Http404("Cause not found.")
    _load_rca(request, cause.rca_id)
    if form.is_valid():
        try:
            mark_cause_supported(
                actor=_actor(request),
                cause_id=cause_id,
                evidence_citation=form.cleaned_data.get("evidence_citation") or "",
            )
        except (PermissionDenied, ValidationError) as exc:
            if isinstance(exc, PermissionDenied):
                raise
            messages.error(request, _validation_message(exc))
        else:
            messages.success(request, "Cause marked supported. Not confirmed.")
    return redirect("rca:detail", rca_id=cause.rca_id)


@login_required
@require_POST
def rca_confirm_cause(request: HttpRequest, cause_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    form = RcaConfirmForm(request.POST)
    from apps.rca.models import RcaCause

    cause = RcaCause.objects.select_related("rca").filter(pk=cause_id).first()
    if cause is None:
        raise Http404("Cause not found.")
    _load_rca(request, cause.rca_id)
    if form.is_valid():
        try:
            confirm_root_cause(
                actor=_actor(request),
                cause_id=cause_id,
                confirmation_note=form.cleaned_data.get("confirmation_note") or "",
            )
        except (PermissionDenied, ValidationError) as exc:
            if isinstance(exc, PermissionDenied):
                raise
            messages.error(request, _validation_message(exc))
        else:
            messages.success(request, "Human confirmation recorded. Not an AI decision.")
    return redirect("rca:detail", rca_id=cause.rca_id)


@login_required
@require_POST
def rca_link_capa(request: HttpRequest, cause_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    form = RcaCapaLinkForm(request.POST)
    from apps.rca.models import RcaCause

    cause = RcaCause.objects.select_related("rca").filter(pk=cause_id).first()
    if cause is None:
        raise Http404("Cause not found.")
    _load_rca(request, cause.rca_id)
    if form.is_valid():
        try:
            link_confirmed_cause_to_capa(
                actor=_actor(request),
                cause_id=cause_id,
                create_follow_up=bool(form.cleaned_data.get("create_follow_up")),
                capa_code=form.cleaned_data.get("capa_code") or "",
                existing_capa_id=form.cleaned_data.get("existing_capa_id"),
            )
        except (PermissionDenied, ValidationError) as exc:
            if isinstance(exc, PermissionDenied):
                raise
            messages.error(request, _validation_message(exc))
        else:
            messages.success(
                request,
                "CAPA linked by explicit action. RCA did not auto-close CAPA.",
            )
    return redirect("rca:detail", rca_id=cause.rca_id)


@login_required
@require_POST
def rca_verify(request: HttpRequest, rca_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    form = RcaVerifyForm(request.POST)
    if form.is_valid():
        try:
            record_rca_verification(
                actor=_actor(request),
                rca_id=rca_id,
                verification_notes=form.cleaned_data["verification_notes"],
            )
        except (PermissionDenied, ValidationError) as exc:
            if isinstance(exc, PermissionDenied):
                raise
            messages.error(request, _validation_message(exc))
        else:
            messages.success(request, "Verification recorded.")
    return redirect("rca:detail", rca_id=rca_id)


@login_required
@require_POST
def rca_close(request: HttpRequest, rca_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    try:
        close_rca(actor=_actor(request), rca_id=rca_id)
    except (PermissionDenied, ValidationError) as exc:
        if isinstance(exc, PermissionDenied):
            raise
        messages.error(request, _validation_message(exc))
    else:
        messages.success(request, "RCA closed and historically locked.")
    return redirect("rca:detail", rca_id=rca_id)


@login_required
@require_POST
def rca_cancel(request: HttpRequest, rca_id: uuid.UUID) -> HttpResponse:
    _require_rca_module(request)
    try:
        cancel_rca(actor=_actor(request), rca_id=rca_id)
    except (PermissionDenied, ValidationError) as exc:
        if isinstance(exc, PermissionDenied):
            raise
        messages.error(request, _validation_message(exc))
    else:
        messages.success(request, "RCA cancelled and historically locked.")
    return redirect("rca:detail", rca_id=rca_id)
