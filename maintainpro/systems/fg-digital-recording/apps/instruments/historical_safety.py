"""Historical safety for equipment — soft lifecycle only."""

from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.instruments.models import CalibrationRecord, Equipment


def refuse_hard_delete_equipment(equipment: Equipment) -> None:
    raise ValidationError(
        {
            "delete": (
                "Hard delete of Equipment is not permitted. "
                "Deactivate / set OUT_OF_SERVICE instead so historical references remain valid."
            )
        }
    )


def refuse_hard_delete_calibration(record: CalibrationRecord) -> None:
    raise ValidationError(
        {
            "delete": (
                "Hard delete of CalibrationRecord is not permitted. "
                "Retain calibration history for auditability."
            )
        }
    )
