"""MaintainPro shared reference-data integration (read-only).

MaintainPro remains the system of record for Vehicle, Asset, Department,
and location-style master data. FG must not create duplicate master
collections for those entities.
"""

from __future__ import annotations

from apps.integrations.maintainpro.reference_service import MaintainProReferenceService

__all__ = ["MaintainProReferenceService"]
