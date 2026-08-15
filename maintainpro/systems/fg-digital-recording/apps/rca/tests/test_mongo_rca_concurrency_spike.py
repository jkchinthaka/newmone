"""RCA close/cancel Mongo-safe concurrency tests (CAS + mutable guard)."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from django.core.exceptions import ValidationError
from django.db import connection
from tests.factories import make_org

from apps.core.db_namespace import restore_postgresql_table_names
from apps.rca.models import RcaSourceKind, RcaStatus
from apps.rca.services import add_five_why_step, cancel_rca, close_rca, create_rca, start_rca
from apps.rca.tests.test_phase49_rca import _rca_user

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def _ensure_pg_table_names() -> None:
    restore_postgresql_table_names()


def _open_rca():
    org = make_org(code=f"RC{uuid.uuid4().hex[:8].upper()}")
    actor = _rca_user(org=org, manage=True, confirm=True)
    rca = create_rca(
        actor=actor,
        organization_id=org.id,
        rca_code=f"SYN-{uuid.uuid4().hex[:8].upper()}",
        source_kind=RcaSourceKind.NCR,
        source_citation="Synthetic citation",
        problem_statement="Synthetic problem statement.",
        facilitator=actor,
    )
    start_rca(actor=actor, rca_id=rca.id)
    return actor, rca


def test_mutation_after_cancel_rejected() -> None:
    actor, rca = _open_rca()
    cancel_rca(actor=actor, rca_id=rca.id)
    with pytest.raises(ValidationError):
        add_five_why_step(
            actor=actor,
            rca_id=rca.id,
            sequence=1,
            why_question="Why?",
            answer="Too late.",
        )


def test_duplicate_cancel_rejected() -> None:
    actor, rca = _open_rca()
    cancel_rca(actor=actor, rca_id=rca.id)
    with pytest.raises(ValidationError):
        cancel_rca(actor=actor, rca_id=rca.id)


def test_cancel_vs_close_only_one_terminal() -> None:
    actor, rca = _open_rca()
    errors: list[BaseException] = []

    def _close() -> None:
        connection.close()
        try:
            close_rca(actor=actor, rca_id=rca.id)
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    def _cancel() -> None:
        connection.close()
        try:
            cancel_rca(actor=actor, rca_id=rca.id)
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(_close)
        f2 = pool.submit(_cancel)
        f1.result()
        f2.result()

    rca.refresh_from_db()
    assert rca.status in {RcaStatus.CLOSED, RcaStatus.CANCELLED}
    assert len(errors) == 1
    assert isinstance(errors[0], ValidationError)
