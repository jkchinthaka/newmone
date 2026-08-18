"""Evidence attachment views — authorized upload/download/retire only."""

from __future__ import annotations

import uuid

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import Http404, HttpRequest, HttpResponse, HttpResponseBase
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import User
from apps.evidence.forms import EvidenceRetireForm, EvidenceUploadForm
from apps.evidence.models import EvidenceLinkedKind
from apps.evidence.selectors import (
    actor_can_access_evidence_module,
    list_evidence_for_link,
)
from apps.evidence.services import (
    build_evidence_file_response,
    retire_evidence_attachment,
    upload_evidence_attachment,
)

PAGE_SIZE = 50


def _actor(request: HttpRequest) -> User:
    return request.user  # type: ignore[return-value]


def _require_module(request: HttpRequest) -> None:
    if not actor_can_access_evidence_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _validation_message(exc: ValidationError) -> str:
    if hasattr(exc, "message_dict"):
        parts: list[str] = []
        for msgs in exc.message_dict.values():
            parts.extend(str(m) for m in msgs)
        return "; ".join(parts)
    return "; ".join(str(m) for m in exc.messages)


@login_required
@require_http_methods(["GET", "POST"])
def evidence_upload(
    request: HttpRequest, linked_kind: str, linked_object_id: uuid.UUID
) -> HttpResponse:
    _require_module(request)
    if linked_kind not in EvidenceLinkedKind.values:
        raise Http404("Unknown evidence link kind.")

    form = EvidenceUploadForm(request.POST or None, request.FILES or None)
    if request.method == "POST" and form.is_valid():
        try:
            attachment = upload_evidence_attachment(
                actor=_actor(request),
                linked_kind=linked_kind,
                linked_object_id=linked_object_id,
                uploaded_file=form.cleaned_data["file"],
                caption=form.cleaned_data.get("caption") or "",
            )
        except ValidationError as exc:
            messages.error(request, _validation_message(exc))
        except PermissionDenied:
            raise
        else:
            messages.success(
                request,
                (
                    f"Evidence uploaded ({attachment.original_filename}). "
                    f"Malware scan status: {attachment.malware_scan_status} "
                    "(not claimed as actively scanned unless configured)."
                ),
            )
            return redirect(
                "evidence:list_for_link",
                linked_kind=linked_kind,
                linked_object_id=linked_object_id,
            )

    return render(
        request,
        "evidence/upload.html",
        {
            "form": form,
            "linked_kind": linked_kind,
            "linked_object_id": linked_object_id,
            "EvidenceLinkedKind": EvidenceLinkedKind,
        },
    )


@login_required
@require_GET
def evidence_list_for_link(
    request: HttpRequest, linked_kind: str, linked_object_id: uuid.UUID
) -> HttpResponse:
    _require_module(request)
    if linked_kind not in EvidenceLinkedKind.values:
        raise Http404("Unknown evidence link kind.")
    rows = list(
        list_evidence_for_link(
            _actor(request), linked_kind=linked_kind, linked_object_id=linked_object_id
        )
    )
    return render(
        request,
        "evidence/list.html",
        {
            "attachments": rows,
            "linked_kind": linked_kind,
            "linked_object_id": linked_object_id,
        },
    )


@login_required
@require_GET
def evidence_download(request: HttpRequest, attachment_id: uuid.UUID) -> HttpResponseBase:
    _require_module(request)
    try:
        return build_evidence_file_response(actor=_actor(request), attachment_id=attachment_id)
    except ValidationError as exc:
        raise Http404(_validation_message(exc)) from exc
    except PermissionDenied:
        raise


@login_required
@require_http_methods(["GET", "POST"])
def evidence_retire(request: HttpRequest, attachment_id: uuid.UUID) -> HttpResponse:
    _require_module(request)
    form = EvidenceRetireForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            attachment = retire_evidence_attachment(
                actor=_actor(request),
                attachment_id=attachment_id,
                reason=form.cleaned_data["reason"],
            )
        except ValidationError as exc:
            messages.error(request, _validation_message(exc))
        except PermissionDenied:
            raise
        else:
            messages.success(request, "Evidence soft-retired (no hard delete).")
            return redirect(
                "evidence:list_for_link",
                linked_kind=attachment.linked_kind,
                linked_object_id=attachment.linked_object_id,
            )
    return render(
        request,
        "evidence/retire.html",
        {"form": form, "attachment_id": attachment_id},
    )
