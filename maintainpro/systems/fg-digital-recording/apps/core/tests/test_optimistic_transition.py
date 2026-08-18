"""Unit tests for Mongo-safe optimistic transition primitive."""

from __future__ import annotations

import uuid

import pytest

from apps.core.optimistic_transition import (
    TransitionConflictError,
    cas_status_transition,
    conditional_update,
    create_immutable_unique,
    require_conditional_update,
)


@pytest.mark.django_db
def test_conditional_update_and_conflict_on_organizations() -> None:
    from tests.factories import make_org

    org = make_org(code="CASORG01", name="CAS Org")
    from apps.organizations.models import Organization

    result = conditional_update(
        Organization.objects.all(),
        expected={"pk": org.pk, "name": "CAS Org"},
        updates={"name": "CAS Org Updated"},
    )
    assert result.applied is True
    org.refresh_from_db()
    assert org.name == "CAS Org Updated"

    with pytest.raises(TransitionConflictError):
        require_conditional_update(
            Organization.objects.all(),
            expected={"pk": org.pk, "name": "CAS Org"},
            updates={"name": "should-fail"},
        )


@pytest.mark.django_db(transaction=True)
def test_create_immutable_unique_supervisor_style() -> None:
    """Uses real SupervisorReview unique(submission) semantics via factories."""
    from tests.factories import make_org

    from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
    from apps.reviews.tests.test_phase09a_supervisor_review import _reviewer, _submitted

    org = make_org(code=f"IMM{uuid.uuid4().hex[:8].upper()}")
    data = _submitted(org=org, batch="IMM-B1", code="IMM-C1")
    reviewer = _reviewer(org=org)
    submission = data["submission"]

    first, first_created = create_immutable_unique(
        model=SupervisorReview,
        create_kwargs={
            "organization_id": org.id,
            "checklist_submission": submission,
            "decision": SupervisorReviewDecision.APPROVED,
            "review_note": "",
            "reviewed_by": reviewer,
        },
        unique_lookup={"checklist_submission_id": submission.id},
        decision_field="decision",
        decision_value=SupervisorReviewDecision.APPROVED,
    )
    second, second_created = create_immutable_unique(
        model=SupervisorReview,
        create_kwargs={
            "organization_id": org.id,
            "checklist_submission": submission,
            "decision": SupervisorReviewDecision.APPROVED,
            "review_note": "retry",
            "reviewed_by": reviewer,
        },
        unique_lookup={"checklist_submission_id": submission.id},
        decision_field="decision",
        decision_value=SupervisorReviewDecision.APPROVED,
    )
    assert first.id == second.id
    assert first_created is True
    assert second_created is False

    with pytest.raises(TransitionConflictError):
        create_immutable_unique(
            model=SupervisorReview,
            create_kwargs={
                "organization_id": org.id,
                "checklist_submission": submission,
                "decision": SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
                "review_note": "",
                "reviewed_by": reviewer,
            },
            unique_lookup={"checklist_submission_id": submission.id},
            decision_field="decision",
            decision_value=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        )


@pytest.mark.django_db
def test_cas_status_transition_rejects_stale_predicate() -> None:
    from tests.factories import make_org

    from apps.organizations.models import Organization

    org = make_org(code="CASSTAT1", name="CAS Status")
    updated = cas_status_transition(
        Organization,
        pk=org.pk,
        from_status=True,
        to_status=False,
        extra_updates={"name": "CAS Status Off"},
        status_field="is_active",
    )
    assert updated.is_active is False
    assert updated.name == "CAS Status Off"
    with pytest.raises(TransitionConflictError):
        cas_status_transition(
            Organization,
            pk=org.pk,
            from_status=True,
            to_status=False,
            status_field="is_active",
        )
