"""Historical safety for organization hierarchy — soft lifecycle only."""

from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.organizations.models import Department, Organization, Shift, Site


def refuse_hard_delete(entity: Organization | Site | Department | Shift) -> None:
    """
    Hard delete is never permitted for organization hierarchy or Shift rows.

    Historical recording / RBAC / checklist rows use PROTECT FKs; application
    services must deactivate (and end-date Shifts) instead of deleting.
    """
    label = entity.__class__.__name__
    raise ValidationError(
        {
            "delete": (
                f"Hard delete of {label} is not permitted. "
                "Deactivate (and set Shift effective_to when applicable) instead."
            )
        }
    )
