"""Historical safety for training — soft lifecycle only."""

from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.training.models import TrainingEnforcementPolicy, TrainingRecord


def refuse_hard_delete_training_record(record: TrainingRecord) -> None:
    raise ValidationError(
        {
            "delete": (
                "Hard delete of TrainingRecord is not permitted. "
                "Prefer SUPERSEDED / VOID so historical competency evidence remains."
            )
        }
    )


def refuse_hard_delete_training_policy(policy: TrainingEnforcementPolicy) -> None:
    raise ValidationError(
        {
            "delete": (
                "Hard delete of TrainingEnforcementPolicy is not permitted. "
                "Set gate_mode=OFF instead."
            )
        }
    )
