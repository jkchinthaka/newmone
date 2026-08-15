"""QA review views — queue, detail, confirm, immutable result."""

from __future__ import annotations

import uuid

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Paginator
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import User
from apps.quality.forms import QAReviewConfirmForm
from apps.quality.models import QAReviewDecision
from apps.quality.selectors import (
    actor_can_access_qa_module,
    get_qa_review,
    list_qa_reviewable_submissions,
    load_qa_submission_context,
)
from apps.quality.services import create_qa_review
from apps.recording.snapshot_display import render_snapshot_sections
from apps.reviews.models import SupervisorReviewDecision

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return request.user  # type: ignore[return-value]


def _require_qa_module(request: HttpRequest) -> None:
    if not actor_can_access_qa_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _validation_message(exc: ValidationError) -> str:
    if hasattr(exc, "message_dict"):
        parts: list[str] = []
        for msgs in exc.message_dict.values():
            parts.extend(str(m) for m in msgs)
        return "; ".join(parts)
    return "; ".join(str(m) for m in exc.messages)


def _decision_label(decision: str) -> str:
    labels: dict[str, str] = {
        QAReviewDecision.RELEASE: "RELEASE",
        QAReviewDecision.HOLD: "HOLD",
        QAReviewDecision.REJECT: "REJECT",
    }
    return labels.get(decision, decision)


@login_required
@require_GET
def qa_queue(request: HttpRequest) -> HttpResponse:
    _require_qa_module(request)
    submissions = list_qa_reviewable_submissions(_actor(request))
    page = Paginator(submissions, PAGE_SIZE).get_page(request.GET.get("page") or 1)
    return render(
        request,
        "quality/queue/list.html",
        {
            "page": page,
            "submissions": page.object_list,
        },
    )


@login_required
@require_GET
def submission_detail(request: HttpRequest, submission_id: uuid.UUID) -> HttpResponse:
    _require_qa_module(request)
    try:
        context = load_qa_submission_context(_actor(request), submission_id)
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist submission not found.")

    if context["qa_review"] is not None:
        return redirect("quality:qa_result", review_id=context["qa_review"].id)

    return render(
        request,
        "quality/submissions/detail.html",
        {
            **context,
            "rendered_sections": context.get("rendered_sections")
            or render_snapshot_sections(context["sections"], context["snapshot_responses"]),
            "QAReviewDecision": QAReviewDecision,
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
def confirm_decision(request: HttpRequest, submission_id: uuid.UUID, decision: str) -> HttpResponse:
    _require_qa_module(request)
    if decision not in QAReviewDecision.values:
        raise Http404("Unknown QA decision.")

    try:
        context = load_qa_submission_context(_actor(request), submission_id)
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist submission not found.")

    if context["qa_review"] is not None:
        messages.info(request, "This submission already has a QA review.")
        return redirect("quality:qa_result", review_id=context["qa_review"].id)

    if request.method == "POST":
        form = QAReviewConfirmForm(request.POST)
        if form.is_valid():
            try:
                review = create_qa_review(
                    actor=_actor(request),
                    submission_id=submission_id,
                    decision=decision,
                    review_note=form.cleaned_data["review_note"],
                )
            except ValidationError as exc:
                messages.error(request, _validation_message(exc))
                return redirect("quality:submission_detail", submission_id=submission_id)
            messages.success(request, "QA review disposition recorded.")
            return redirect("quality:qa_result", review_id=review.id)
    else:
        form = QAReviewConfirmForm()

    return render(
        request,
        "quality/submissions/confirm.html",
        {
            **context,
            "form": form,
            "decision": decision,
            "decision_label": _decision_label(decision),
            "QAReviewDecision": QAReviewDecision,
            "SupervisorReviewDecision": SupervisorReviewDecision,
        },
    )


@login_required
@require_GET
def qa_result(request: HttpRequest, review_id: uuid.UUID) -> HttpResponse:
    _require_qa_module(request)
    try:
        review = get_qa_review(_actor(request), review_id)
    except PermissionDenied:
        raise
    if review is None:
        raise Http404("QA review not found.")

    submission = review.checklist_submission
    try:
        context = load_qa_submission_context(_actor(request), submission.id)
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist submission not found.")

    return render(
        request,
        "quality/reviews/result.html",
        {
            **context,
            "qa_review": review,
            "rendered_sections": context.get("rendered_sections")
            or render_snapshot_sections(context["sections"], context["snapshot_responses"]),
            "QAReviewDecision": QAReviewDecision,
            "SupervisorReviewDecision": SupervisorReviewDecision,
        },
    )
