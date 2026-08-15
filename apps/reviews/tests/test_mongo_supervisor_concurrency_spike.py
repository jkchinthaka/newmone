"""Concurrency spike tests for Supervisor review CAS / unique-insert pattern."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import uuid

import pytest
from django.core.exceptions import ValidationError
from django.db import connection, transaction
from tests.factories import make_org

from apps.core.db_namespace import restore_postgresql_table_names
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.reviews.mongo_spike import create_supervisor_review_cas
from apps.reviews.tests.test_phase09a_supervisor_review import _reviewer, _submitted

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def _ensure_pg_table_names() -> None:
    restore_postgresql_table_names()


def _fixture():
    org = make_org(code=f"SPK{uuid.uuid4().hex[:8].upper()}")
    data = _submitted(org=org, batch=f"B-{uuid.uuid4().hex[:6]}", code=f"C{uuid.uuid4().hex[:6]}")
    reviewer = _reviewer(org=org)
    return org, reviewer, data["submission"]


def test_cas_approve_vs_approve_idempotent() -> None:
    _, supervisor, submission = _fixture()

    def _run() -> SupervisorReview:
        connection.close()
        return create_supervisor_review_cas(
            actor=supervisor,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.APPROVED,
            review_note="ok",
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(_run), pool.submit(_run)]
        results = [f.result() for f in as_completed(futures)]

    assert results[0].id == results[1].id
    assert SupervisorReview.objects.filter(checklist_submission=submission).count() == 1
    assert results[0].decision == SupervisorReviewDecision.APPROVED


def test_cas_approve_vs_return_only_one_wins() -> None:
    _, supervisor, submission = _fixture()
    errors: list[BaseException] = []
    wins: list[SupervisorReview] = []

    def _approve() -> None:
        connection.close()
        try:
            wins.append(
                create_supervisor_review_cas(
                    actor=supervisor,
                    submission_id=submission.id,
                    decision=SupervisorReviewDecision.APPROVED,
                )
            )
        except Exception as exc:  # noqa: BLE001 — collect race outcomes
            errors.append(exc)

    def _return() -> None:
        connection.close()
        try:
            wins.append(
                create_supervisor_review_cas(
                    actor=supervisor,
                    submission_id=submission.id,
                    decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
                )
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(_approve)
        f2 = pool.submit(_return)
        f1.result()
        f2.result()

    assert SupervisorReview.objects.filter(checklist_submission=submission).count() == 1
    assert len(wins) == 1
    assert len(errors) == 1
    assert isinstance(errors[0], ValidationError)


def test_cas_return_vs_return_idempotent() -> None:
    _, supervisor, submission = _fixture()

    def _run() -> SupervisorReview:
        connection.close()
        return create_supervisor_review_cas(
            actor=supervisor,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [f.result() for f in as_completed([pool.submit(_run), pool.submit(_run)])]

    assert results[0].id == results[1].id
    assert results[0].decision == SupervisorReviewDecision.RETURNED_FOR_CORRECTION


def test_cas_duplicate_post_same_decision() -> None:
    _, supervisor, submission = _fixture()
    first = create_supervisor_review_cas(
        actor=supervisor,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="n1",
    )
    second = create_supervisor_review_cas(
        actor=supervisor,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="n2",
    )
    assert first.id == second.id
    assert SupervisorReview.objects.filter(checklist_submission=submission).count() == 1


def test_cas_stale_conflicting_decision() -> None:
    _, supervisor, submission = _fixture()
    create_supervisor_review_cas(
        actor=supervisor,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    with pytest.raises(ValidationError):
        create_supervisor_review_cas(
            actor=supervisor,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        )


def test_network_retry_same_decision_after_commit() -> None:
    """Simulates client retry after uncertain network response."""
    _, supervisor, submission = _fixture()
    with transaction.atomic():
        review = create_supervisor_review_cas(
            actor=supervisor,
            submission_id=submission.id,
            decision=SupervisorReviewDecision.APPROVED,
        )
    retry = create_supervisor_review_cas(
        actor=supervisor,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
    )
    assert retry.id == review.id
