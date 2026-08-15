"""POC service patterns: unique+retry and Mongo backend atomic transactions.

Uses ``django_mongodb_backend.transaction.atomic`` — Django's
``django.db.transaction.atomic`` is a no-op on this backend.
"""

from __future__ import annotations

import time

from django.db import DatabaseError, IntegrityError
from django.db.models import Max
from django_mongodb_backend import transaction as mongo_transaction

from apps.mongo_poc.models import (
    PocChecklistTemplate,
    PocChecklistVersion,
    PocCorrection,
    PocEmployee,
    PocIdempotencyKey,
    PocOrganization,
    PocQAReview,
    PocRecord,
    PocResponseSnapshot,
    PocSubmission,
    PocSupervisorReview,
    PocTask,
)


def normalize_employee_code(raw: str) -> str:
    return raw.strip().casefold()


def get_or_create_organization(*, code: str) -> PocOrganization:
    org, _ = PocOrganization.objects.get_or_create(code=code)
    return org


def create_employee_idempotent(*, organization: PocOrganization, employee_code: str) -> PocEmployee:
    normalized = normalize_employee_code(employee_code)
    try:
        return PocEmployee.objects.create(
            organization=organization,
            employee_code_normalized=normalized,
        )
    except IntegrityError:
        return PocEmployee.objects.get(
            organization=organization,
            employee_code_normalized=normalized,
        )


def create_task_idempotent(
    *,
    organization: PocOrganization,
    template: PocChecklistTemplate,
    batch_reference: str,
) -> PocTask:
    try:
        return PocTask.objects.create(
            organization=organization,
            template=template,
            batch_reference=batch_reference,
        )
    except IntegrityError:
        return PocTask.objects.get(
            organization=organization,
            template=template,
            batch_reference=batch_reference,
        )


def start_record_idempotent(*, task: PocTask) -> PocRecord:
    try:
        return PocRecord.objects.create(
            task=task,
            organization=task.organization,
            status="draft",
        )
    except IntegrityError:
        return PocRecord.objects.get(task=task)


def allocate_version_number(*, template: PocChecklistTemplate) -> PocChecklistVersion:
    """Allocate next version via Max+1 with unique-constraint retry (no row lock)."""
    for _ in range(16):
        current = (
            PocChecklistVersion.objects.filter(template=template).aggregate(
                m=Max("version_number")
            )["m"]
            or 0
        )
        candidate = current + 1
        try:
            return PocChecklistVersion.objects.create(template=template, version_number=candidate)
        except IntegrityError:
            continue
    raise RuntimeError("version allocation exhausted retries")


def submit_immutable_snapshot(
    *,
    record: PocRecord,
    responses: list[tuple[str, int, str]],
    marker: str = "",
    fail_after_header: bool = False,
) -> PocSubmission:
    """Create submission header + response children in one Mongo transaction."""
    with mongo_transaction.atomic():
        next_number = (
            PocSubmission.objects.filter(record=record).aggregate(m=Max("submission_number"))["m"]
            or 0
        ) + 1
        submission = PocSubmission.objects.create(
            record=record,
            organization=record.organization,
            submission_number=next_number,
            is_immutable=True,
            payload_marker=marker,
        )
        if fail_after_header:
            raise RuntimeError("forced abort after header")
        for item_key, sample_index, value_text in responses:
            PocResponseSnapshot.objects.create(
                submission=submission,
                item_key=item_key,
                sample_index=sample_index,
                value_text=value_text,
                calculation_context={"operator": "SUM", "inputs": [1, 2]},
            )
        return submission


def _is_retryable_db_error(exc: BaseException) -> bool:
    """Integrity conflicts and Mongo TransientTransactionError / WriteConflict."""
    if isinstance(exc, IntegrityError):
        return True
    if isinstance(exc, DatabaseError):
        cause = exc.__cause__
        labels = getattr(cause, "errorLabels", None) or []
        if "TransientTransactionError" in labels:
            return True
        code = getattr(cause, "code", None)
        if code in {112, 251}:  # WriteConflict, NoSuchTransaction
            return True
        text = str(cause or exc).lower()
        if "writeconflict" in text or "transienttransactionerror" in text:
            return True
    return False


def submit_with_number_retry(
    *,
    record: PocRecord,
    responses: list[tuple[str, int, str]],
    marker: str = "",
) -> PocSubmission:
    """Concurrent-safe submit using unique (record, number) + txn retry."""
    last_error: Exception | None = None
    for attempt in range(24):
        try:
            return submit_immutable_snapshot(record=record, responses=responses, marker=marker)
        except Exception as exc:
            if not _is_retryable_db_error(exc):
                raise
            last_error = exc
            time.sleep(0.01 * (attempt + 1))
            continue
    raise RuntimeError(f"submit retries exhausted: {last_error}")


def start_supervisor_review_idempotent(
    *, submission: PocSubmission, decision: str
) -> PocSupervisorReview:
    try:
        return PocSupervisorReview.objects.create(submission=submission, decision=decision)
    except IntegrityError:
        existing = PocSupervisorReview.objects.get(submission=submission)
        if existing.decision != decision:
            raise ConflictError(
                "supervisor review already exists with different decision"
            ) from None
        return existing


def start_correction_idempotent(*, source_submission: PocSubmission) -> PocCorrection:
    try:
        return PocCorrection.objects.create(
            source_submission=source_submission,
            record=source_submission.record,
            status="open",
        )
    except IntegrityError:
        return PocCorrection.objects.get(source_submission=source_submission)


def start_qa_review_idempotent(
    *,
    submission: PocSubmission,
    supervisor_review: PocSupervisorReview,
    decision: str,
) -> PocQAReview:
    if supervisor_review.submission_id != submission.id:
        raise ConflictError("QA review supervisor linkage mismatch")
    try:
        return PocQAReview.objects.create(
            submission=submission,
            supervisor_review=supervisor_review,
            decision=decision,
        )
    except IntegrityError:
        existing = PocQAReview.objects.get(submission=submission)
        if existing.supervisor_review_id != supervisor_review.id:
            raise ConflictError("QA review already linked to different supervisor review") from None
        if existing.decision != decision:
            raise ConflictError("QA review already exists with different decision") from None
        return existing


def idempotent_request(*, scope: str, key: str, result_ref: str) -> tuple[PocIdempotencyKey, bool]:
    """Return (row, created). Duplicate key returns existing without rewrite."""
    try:
        row = PocIdempotencyKey.objects.create(scope=scope, key=key, result_ref=result_ref)
        return row, True
    except IntegrityError:
        return PocIdempotencyKey.objects.get(scope=scope, key=key), False


class ConflictError(Exception):
    """Domain conflict that must not silently overwrite."""
