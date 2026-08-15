"""Concurrency spike tests for QA review CAS / unique-insert pattern."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
from django.core.exceptions import ValidationError
from django.db import connection
from tests.factories import make_org

from apps.core.db_namespace import restore_postgresql_table_names
from apps.quality.models import QAReview, QAReviewDecision
from apps.quality.services import create_qa_review
from apps.quality.tests.test_phase10a_qa_review import _approved_submission, _qa_actor

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def _ensure_pg_table_names() -> None:
    restore_postgresql_table_names()


def _fixture() -> tuple[object, object]:
    org = make_org(code=f"QA{uuid.uuid4().hex[:8].upper()}")
    data = _approved_submission(org=org)
    qa = _qa_actor(org=org)
    return qa, data["submission"]


def test_cas_release_vs_release_idempotent() -> None:
    qa, submission = _fixture()

    def _run() -> QAReview:
        connection.close()
        return create_qa_review(
            actor=qa,
            submission_id=submission.id,
            decision=QAReviewDecision.RELEASE,
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [f.result() for f in as_completed([pool.submit(_run), pool.submit(_run)])]

    assert results[0].id == results[1].id
    assert QAReview.objects.filter(checklist_submission=submission).count() == 1


@pytest.mark.parametrize(
    ("left", "right"),
    [
        (QAReviewDecision.RELEASE, QAReviewDecision.HOLD),
        (QAReviewDecision.RELEASE, QAReviewDecision.REJECT),
        (QAReviewDecision.HOLD, QAReviewDecision.REJECT),
    ],
)
def test_cas_conflicting_dispositions_one_wins(left: str, right: str) -> None:
    qa, submission = _fixture()
    wins: list[QAReview] = []
    errors: list[BaseException] = []

    def _decide(decision: str) -> None:
        connection.close()
        try:
            wins.append(
                create_qa_review(
                    actor=qa,
                    submission_id=submission.id,
                    decision=decision,
                )
            )
        except Exception as exc:  # noqa: BLE001 — collect race outcomes
            errors.append(exc)

    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(_decide, left)
        f2 = pool.submit(_decide, right)
        f1.result()
        f2.result()

    assert QAReview.objects.filter(checklist_submission=submission).count() == 1
    assert len(wins) == 1
    assert len(errors) == 1
    assert isinstance(errors[0], ValidationError)


def test_cas_hold_vs_hold_idempotent() -> None:
    qa, submission = _fixture()

    def _run() -> QAReview:
        connection.close()
        return create_qa_review(
            actor=qa,
            submission_id=submission.id,
            decision=QAReviewDecision.HOLD,
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [f.result() for f in as_completed([pool.submit(_run), pool.submit(_run)])]

    assert results[0].id == results[1].id
    assert results[0].decision == QAReviewDecision.HOLD


def test_cas_reject_vs_reject_idempotent() -> None:
    qa, submission = _fixture()

    def _run() -> QAReview:
        connection.close()
        return create_qa_review(
            actor=qa,
            submission_id=submission.id,
            decision=QAReviewDecision.REJECT,
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [f.result() for f in as_completed([pool.submit(_run), pool.submit(_run)])]

    assert results[0].id == results[1].id


def test_cas_duplicate_retry_same_decision() -> None:
    qa, submission = _fixture()
    first = create_qa_review(
        actor=qa,
        submission_id=submission.id,
        decision=QAReviewDecision.RELEASE,
        review_note="n1",
    )
    second = create_qa_review(
        actor=qa,
        submission_id=submission.id,
        decision=QAReviewDecision.RELEASE,
        review_note="n2",
    )
    assert first.id == second.id


def test_cas_stale_conflicting_decision() -> None:
    qa, submission = _fixture()
    create_qa_review(
        actor=qa,
        submission_id=submission.id,
        decision=QAReviewDecision.RELEASE,
    )
    with pytest.raises(ValidationError):
        create_qa_review(
            actor=qa,
            submission_id=submission.id,
            decision=QAReviewDecision.HOLD,
        )
