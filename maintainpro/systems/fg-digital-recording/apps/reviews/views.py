"""Supervisor review views — queue, detail, confirm, immutable result (09A/09C)."""

from __future__ import annotations

import uuid
from typing import cast

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from apps.access_control.maintainpro_bridge import assert_fg_permission, require_fg_permission
from django.core.paginator import Paginator
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import User
from apps.recording.snapshot_display import render_snapshot_sections
from apps.reviews.forms import SupervisorReviewConfirmForm
from apps.reviews.governance import (
    QUEUE_OVERDUE,
    QUEUE_PENDING,
    QUEUE_RESUBMISSION,
)
from apps.reviews.models import SupervisorReviewDecision
from apps.reviews.selectors import (
    actor_can_access_review_module,
    get_supervisor_review,
    list_supervisor_review_queue,
    list_supervisor_reviewable_submissions,
    load_submission_review_context,
)
from apps.reviews.services import create_supervisor_review

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return cast(User, request.user)


def _require_review_module(request: HttpRequest) -> None:
    assert_fg_permission(request, "fg.review.view")
    if not actor_can_access_review_module(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _validation_message(exc: ValidationError) -> str:
    if hasattr(exc, "message_dict"):
        parts: list[str] = []
        for msgs in exc.message_dict.values():
            parts.extend(str(m) for m in msgs)
        return "; ".join(parts)
    return "; ".join(str(m) for m in exc.messages)


@login_required
@require_GET
def review_queue(request: HttpRequest) -> HttpResponse:
    _require_review_module(request)
    raw = (request.GET.get("queue") or QUEUE_PENDING).strip().lower()
    queue = raw if raw in {QUEUE_PENDING, QUEUE_OVERDUE, QUEUE_RESUBMISSION} else QUEUE_PENDING
    if queue == QUEUE_PENDING:
        submissions_qs = list_supervisor_reviewable_submissions(_actor(request))
        page = Paginator(submissions_qs, PAGE_SIZE).get_page(request.GET.get("page") or 1)
        submissions = list(page.object_list)
        paginator_page = page
    else:
        rows = list_supervisor_review_queue(_actor(request), queue=queue)
        page = Paginator(rows, PAGE_SIZE).get_page(request.GET.get("page") or 1)
        submissions = list(page.object_list)
        paginator_page = page

    pending_count = list_supervisor_reviewable_submissions(_actor(request)).count()
    overdue_count = len(list_supervisor_review_queue(_actor(request), queue=QUEUE_OVERDUE))
    resubmission_count = len(
        list_supervisor_review_queue(_actor(request), queue=QUEUE_RESUBMISSION)
    )

    return render(
        request,
        "reviews/queue/list.html",
        {
            "page": paginator_page,
            "submissions": submissions,
            "queue": queue,
            "pending_count": pending_count,
            "overdue_count": overdue_count,
            "resubmission_count": resubmission_count,
            "QUEUE_PENDING": QUEUE_PENDING,
            "QUEUE_OVERDUE": QUEUE_OVERDUE,
            "QUEUE_RESUBMISSION": QUEUE_RESUBMISSION,
        },
    )


@login_required
@require_GET
def submission_detail(request: HttpRequest, submission_id: uuid.UUID) -> HttpResponse:
    _require_review_module(request)
    try:
        context = load_submission_review_context(_actor(request), submission_id)
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist submission not found.")

    if context["review"] is not None:
        return redirect("reviews:review_result", review_id=context["review"].id)

    return render(
        request,
        "reviews/submissions/detail.html",
        {
            "submission": context["submission"],
            "record": context["record"],
            "task": context["task"],
            "rendered_sections": context.get("rendered_sections")
            or render_snapshot_sections(context["sections"], context["snapshot_responses"]),
            "SupervisorReviewDecision": SupervisorReviewDecision,
            "governance": context.get("governance"),
            "is_latest_submission": context.get("is_latest_submission", True),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
@require_fg_permission("fg.review.perform")
def confirm_decision(request: HttpRequest, submission_id: uuid.UUID, decision: str) -> HttpResponse:
    _require_review_module(request)
    if decision not in {
        SupervisorReviewDecision.APPROVED,
        SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
    }:
        raise Http404("Unknown review decision.")

    try:
        context = load_submission_review_context(_actor(request), submission_id)
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist submission not found.")

    if context["review"] is not None:
        messages.info(request, "This submission already has a Supervisor review.")
        return redirect("reviews:review_result", review_id=context["review"].id)

    governance = context.get("governance") or {}
    self_review = governance.get("self_review")
    if self_review is not None and getattr(self_review, "blocked", False):
        messages.error(
            request,
            "Self-review is prohibited by owner-approved governance policy.",
        )
        return redirect("reviews:submission_detail", submission_id=submission_id)

    if request.method == "POST":
        form = SupervisorReviewConfirmForm(request.POST)
        if form.is_valid():
            try:
                review = create_supervisor_review(
                    actor=_actor(request),
                    submission_id=submission_id,
                    decision=decision,
                    review_note=form.cleaned_data["review_note"],
                    idempotency_key=request.POST.get("idempotency_key") or "",
                )
            except ValidationError as exc:
                messages.error(request, _validation_message(exc))
                return redirect("reviews:submission_detail", submission_id=submission_id)
            messages.success(request, "Supervisor review recorded.")
            return redirect("reviews:review_result", review_id=review.id)
    else:
        form = SupervisorReviewConfirmForm()

    decision_label = (
        "Approve for future QA stage"
        if decision == SupervisorReviewDecision.APPROVED
        else "Return for correction"
    )
    return render(
        request,
        "reviews/submissions/confirm.html",
        {
            "submission": context["submission"],
            "record": context["record"],
            "task": context["task"],
            "form": form,
            "decision": decision,
            "decision_label": decision_label,
            "SupervisorReviewDecision": SupervisorReviewDecision,
            "governance": governance,
            "is_latest_submission": context.get("is_latest_submission", True),
        },
    )


@login_required
@require_GET
def review_result(request: HttpRequest, review_id: uuid.UUID) -> HttpResponse:
    _require_review_module(request)
    try:
        review = get_supervisor_review(_actor(request), review_id)
    except PermissionDenied:
        raise
    if review is None:
        raise Http404("Supervisor review not found.")

    submission = review.checklist_submission
    try:
        context = load_submission_review_context(_actor(request), submission.id)
    except PermissionDenied:
        raise
    if context is None:
        raise Http404("Checklist submission not found.")

    return render(
        request,
        "reviews/reviews/result.html",
        {
            "review": review,
            "submission": submission,
            "record": context["record"],
            "task": context["task"],
            "rendered_sections": context.get("rendered_sections")
            or render_snapshot_sections(context["sections"], context["snapshot_responses"]),
            "SupervisorReviewDecision": SupervisorReviewDecision,
        },
    )
