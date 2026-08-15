"""Read helpers for foreign-body challenge history."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.foreign_body.models import (
    ChallengeScheduleRule,
    MetalDetectorChallengeTest,
    TestPiece,
)


def list_test_pieces_for_organization(organization_id: uuid.UUID) -> QuerySet[TestPiece]:
    return TestPiece.objects.filter(organization_id=organization_id, is_active=True)


def schedule_rules_for_organization(
    organization_id: uuid.UUID,
) -> QuerySet[ChallengeScheduleRule]:
    return ChallengeScheduleRule.objects.filter(organization_id=organization_id, is_active=True)


def challenge_tests_for_organization(
    organization_id: uuid.UUID,
) -> QuerySet[MetalDetectorChallengeTest]:
    return MetalDetectorChallengeTest.objects.filter(
        organization_id=organization_id
    ).select_related("equipment", "test_piece", "operator", "verifier")
