"""External batch-source integration port — no live ERP/Bileeta connector.

Phase 07B: narrow BatchChecklistTaskRequest → create_batch_checklist_task.
Phase 07F: ExternalBatchEventInput adapter boundary → mapping → applicability →
effective version → ChecklistTask.

Does not invent ProductionBatch masters, vendor schemas-as-fact, webhooks,
credentials, or endpoints. Live production generation remains gated on an
approved batch contract (APR-011 / APR-012).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from apps.accounts.models import User
from apps.scheduling.batch_events import (
    ExternalBatchEventInput,
    process_external_batch_event,
    upsert_external_batch_mapping,
)
from apps.scheduling.models import ChecklistTask, ExternalBatchEvent
from apps.scheduling.services import create_batch_checklist_task

__all__ = [
    "BatchChecklistTaskRequest",
    "ExternalBatchEventInput",
    "accept_batch_checklist_task_request",
    "accept_external_batch_event",
    "process_external_batch_event",
    "upsert_external_batch_mapping",
]


@dataclass(frozen=True)
class BatchChecklistTaskRequest:
    """
    Narrow technical input for pre-mapped batch checklist creation.

    Prefer accept_external_batch_event when source keys must be mapped through
    the Phase 07F adapter boundary.
    """

    organization_id: uuid.UUID
    batch_reference: str
    checklist_template_id: uuid.UUID
    checklist_version_id: uuid.UUID


def accept_batch_checklist_task_request(
    *,
    actor: User | None,
    request: BatchChecklistTaskRequest,
) -> ChecklistTask:
    """
    Accept a technical batch checklist request and create/return a task.

    Authn/authz, PUBLISHED-only rules, idempotency, and version-conflict
    semantics remain owned by ``create_batch_checklist_task``.
    """
    return create_batch_checklist_task(
        actor=actor,
        organization_id=request.organization_id,
        checklist_template_id=request.checklist_template_id,
        checklist_version_id=request.checklist_version_id,
        batch_reference=request.batch_reference,
    )


def accept_external_batch_event(
    *,
    actor: User | None,
    source_system: str,
    source_event_id: str,
    external_batch_id: str,
    external_organization_key: str,
    external_product_key: str = "",
    external_site_key: str = "",
    external_shift_key: str = "",
    external_line_key: str = "",
    as_of: datetime | None = None,
) -> ExternalBatchEvent:
    """Integration-facing entry for Phase 07F adapter-boundary processing."""
    return process_external_batch_event(
        actor=actor,
        event=ExternalBatchEventInput(
            source_system=source_system,
            source_event_id=source_event_id,
            external_batch_id=external_batch_id,
            external_organization_key=external_organization_key,
            external_product_key=external_product_key,
            external_site_key=external_site_key,
            external_shift_key=external_shift_key,
            external_line_key=external_line_key,
            as_of=as_of,
        ),
    )
