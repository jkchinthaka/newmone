"""Concurrent and transactional proofs for MongoDB POC invariants."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
from django.db import IntegrityError
from django.test import TestCase

from apps.mongo_poc.admin import PocSubmissionAdmin
from apps.mongo_poc.models import (
    PocChecklistTemplate,
    PocCorrection,
    PocEmployee,
    PocOrganization,
    PocQAReview,
    PocRecord,
    PocResponseSnapshot,
    PocSubmission,
    PocSupervisorReview,
    PocTask,
)
from apps.mongo_poc.services import (
    allocate_version_number,
    create_employee_idempotent,
    create_task_idempotent,
    idempotent_request,
    start_correction_idempotent,
    start_qa_review_idempotent,
    start_record_idempotent,
    start_supervisor_review_idempotent,
    submit_immutable_snapshot,
    submit_with_number_retry,
)

pytestmark = pytest.mark.mongo_poc


class MongoPocBase(TestCase):
    def setUp(self) -> None:
        self.org = PocOrganization.objects.create(code="ORG-POC-A")
        self.template = PocChecklistTemplate.objects.create(organization=self.org, key="tmpl-a")


class TestStartupAndUniqueness(MongoPocBase):
    def test_django_uses_mongodb_backend(self) -> None:
        from django.conf import settings

        assert settings.DATABASES["default"]["ENGINE"] == "django_mongodb_backend"

    def test_employee_code_uniqueness_casefold(self) -> None:
        create_employee_idempotent(organization=self.org, employee_code=" AbC ")
        create_employee_idempotent(organization=self.org, employee_code="abc")
        assert PocEmployee.objects.filter(organization=self.org).count() == 1

    def test_organization_isolation_on_employee_codes(self) -> None:
        other = PocOrganization.objects.create(code="ORG-POC-B")
        create_employee_idempotent(organization=self.org, employee_code="E1")
        create_employee_idempotent(organization=other, employee_code="E1")
        assert PocEmployee.objects.count() == 2

    def test_concurrent_task_create(self) -> None:
        barrier = threading.Barrier(8)

        def worker() -> PocTask:
            barrier.wait()
            return create_task_idempotent(
                organization=self.org,
                template=self.template,
                batch_reference="BATCH-1",
            )

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: worker(), range(8)))
        ids = {str(r.id) for r in results}
        assert len(ids) == 1
        assert PocTask.objects.filter(batch_reference="BATCH-1").count() == 1

    def test_concurrent_start_record(self) -> None:
        task = create_task_idempotent(
            organization=self.org,
            template=self.template,
            batch_reference="BATCH-REC",
        )
        barrier = threading.Barrier(8)

        def worker() -> PocRecord:
            barrier.wait()
            return start_record_idempotent(task=task)

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: worker(), range(8)))
        assert len({str(r.id) for r in results}) == 1
        assert PocRecord.objects.filter(task=task).count() == 1

    def test_concurrent_version_allocation(self) -> None:
        barrier = threading.Barrier(6)

        def worker() -> int:
            barrier.wait()
            return allocate_version_number(template=self.template).version_number

        with ThreadPoolExecutor(max_workers=6) as pool:
            numbers = list(pool.map(lambda _: worker(), range(6)))
        assert sorted(numbers) == list(range(1, 7))
        assert len(set(numbers)) == 6


class TestSubmissionAndReviews(MongoPocBase):
    def setUp(self) -> None:
        super().setUp()
        self.task = create_task_idempotent(
            organization=self.org,
            template=self.template,
            batch_reference="BATCH-SUB",
        )
        self.record = start_record_idempotent(task=self.task)

    def test_immutable_submission_and_responses(self) -> None:
        sub = submit_with_number_retry(
            record=self.record,
            responses=[("temp", 0, "1.0"), ("temp", 1, "2.0")],
            marker="m1",
        )
        assert sub.is_immutable is True
        assert sub.responses.count() == 2
        assert sub.submission_number == 1

    def test_atomic_rollback_on_abort(self) -> None:
        with pytest.raises(RuntimeError, match="forced abort"):
            submit_immutable_snapshot(
                record=self.record,
                responses=[("x", 0, "1")],
                fail_after_header=True,
            )
        assert PocSubmission.objects.filter(record=self.record).count() == 0
        assert PocResponseSnapshot.objects.count() == 0

    def test_concurrent_submit_one_number_one(self) -> None:
        barrier = threading.Barrier(6)

        def worker(i: int) -> PocSubmission | Exception:
            barrier.wait()
            try:
                return submit_with_number_retry(
                    record=self.record,
                    responses=[("a", 0, str(i))],
                    marker=f"w{i}",
                )
            except Exception as exc:  # noqa: BLE001 — collect concurrency outcomes
                return exc

        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = [pool.submit(worker, i) for i in range(6)]
            results = [f.result() for f in as_completed(futures)]

        submissions = [r for r in results if isinstance(r, PocSubmission)]
        assert len(submissions) >= 1
        numbers = sorted(
            PocSubmission.objects.filter(record=self.record).values_list(
                "submission_number", flat=True
            )
        )
        assert numbers == list(range(1, len(numbers) + 1))
        assert len(numbers) == len(set(numbers))
        # Every successful concurrent submit must produce a full response set.
        for sub in PocSubmission.objects.filter(record=self.record):
            assert sub.responses.count() == 1

    def test_supervisor_review_uniqueness(self) -> None:
        sub = submit_with_number_retry(record=self.record, responses=[("a", 0, "1")], marker="s")
        barrier = threading.Barrier(6)

        def worker() -> PocSupervisorReview:
            barrier.wait()
            return start_supervisor_review_idempotent(submission=sub, decision="return")

        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _: worker(), range(6)))
        assert len({str(r.id) for r in results}) == 1
        assert PocSupervisorReview.objects.filter(submission=sub).count() == 1

    def test_correction_uniqueness(self) -> None:
        sub = submit_with_number_retry(record=self.record, responses=[("a", 0, "1")], marker="c")
        barrier = threading.Barrier(6)

        def worker() -> PocCorrection:
            barrier.wait()
            return start_correction_idempotent(source_submission=sub)

        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _: worker(), range(6)))
        assert len({str(r.id) for r in results}) == 1
        assert PocCorrection.objects.filter(source_submission=sub).count() == 1

    def test_correction_resubmit_numbering(self) -> None:
        first = submit_with_number_retry(record=self.record, responses=[("a", 0, "1")], marker="n1")
        start_correction_idempotent(source_submission=first)
        barrier = threading.Barrier(4)

        def worker(i: int) -> PocSubmission:
            barrier.wait()
            return submit_with_number_retry(
                record=self.record,
                responses=[("a", 0, str(i))],
                marker=f"n{i}",
            )

        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(worker, range(4)))
        numbers = sorted(
            PocSubmission.objects.filter(record=self.record).values_list(
                "submission_number", flat=True
            )
        )
        assert numbers[0] == 1
        assert len(numbers) == len(set(numbers))
        assert numbers == list(range(1, len(numbers) + 1))

    def test_qa_review_uniqueness(self) -> None:
        sub = submit_with_number_retry(record=self.record, responses=[("a", 0, "1")], marker="q")
        supervisor = start_supervisor_review_idempotent(submission=sub, decision="approve")
        barrier = threading.Barrier(6)

        def worker() -> PocQAReview:
            barrier.wait()
            return start_qa_review_idempotent(
                submission=sub,
                supervisor_review=supervisor,
                decision="release_candidate",
            )

        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _: worker(), range(6)))
        assert len({str(r.id) for r in results}) == 1
        assert PocQAReview.objects.filter(submission=sub).count() == 1

    def test_idempotent_duplicate_requests(self) -> None:
        barrier = threading.Barrier(8)

        def worker(i: int) -> tuple[str, bool]:
            barrier.wait()
            row, created = idempotent_request(scope="submit", key="idem-1", result_ref=f"ref-{i}")
            return str(row.id), created

        with ThreadPoolExecutor(max_workers=8) as pool:
            outcomes = list(pool.map(worker, range(8)))
        ids = {oid for oid, _ in outcomes}
        created_flags = [c for _, c in outcomes]
        assert len(ids) == 1
        assert sum(1 for c in created_flags if c) == 1


class TestAdminAndSchema(MongoPocBase):
    def test_admin_modeladmin_is_read_only(self) -> None:
        # Full django.contrib.admin + auth.User requires ObjectId PK refactor
        # (PASS_WITH_REFACTOR). ModelAdmin policy itself is verified here.
        model_admin = PocSubmissionAdmin(PocSubmission, None)  # type: ignore[arg-type]
        assert model_admin.has_add_permission(None) is False  # type: ignore[arg-type]
        assert model_admin.has_change_permission(None) is False  # type: ignore[arg-type]
        assert model_admin.has_delete_permission(None) is False  # type: ignore[arg-type]

    def test_duplicate_employee_raises_integrity_error_raw(self) -> None:
        PocEmployee.objects.create(organization=self.org, employee_code_normalized="z1")
        with pytest.raises(IntegrityError):
            PocEmployee.objects.create(organization=self.org, employee_code_normalized="z1")
