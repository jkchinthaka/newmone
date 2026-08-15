# Production Batch Source Contract

**Document status:** Architecture contract — **not** an implemented ERP/Bileeta connector
**Created:** 2026-08-07 (Phase 07B)
**Related:** [ADR-012](../architecture/ADR-012-BATCH-SOURCE-AND-RECORDER-AUTHORIZATION.md), [ADR-011](../architecture/ADR-011-BATCH-CHECKLIST-TASK-FOUNDATION.md)

## Purpose

Describe what a future production-batch integration must supply before real automatic checklist-task generation is authorized.

This document does **not** invent:

- API URLs
- ERP table names
- Bileeta endpoint names
- credentials
- webhook schemas
- event payload samples presented as facts

Unknown values are **EVIDENCE REQUIRED**.

## Current technical consumer

Phase 07A/07B task creation accepts:

| Field | Required | Notes |
| --- | --- | --- |
| `organization_id` | Yes | Must map to an existing Organization |
| `batch_reference` | Yes | Trimmed external/business batch identity; case-preserving |
| `checklist_template_id` | Yes | Explicit template |
| `checklist_version_id` | Yes | Explicit **PUBLISHED** version only |

Code port: `apps.scheduling.integration.accept_batch_checklist_task_request`
Domain service: `create_batch_checklist_task`

## Conceptual source contract (future)

| Concept | Requirement | Status |
| --- | --- | --- |
| Source system identifier | Stable label for the originating system | EVIDENCE REQUIRED |
| External batch reference | Maps to `batch_reference` | EVIDENCE REQUIRED (format/rules) |
| Organization mapping | External plant/company → Organization UUID | EVIDENCE REQUIRED |
| Event/action meaning | Create task / cancel / ignore | EVIDENCE REQUIRED |
| Creation timestamp | Optional if supplied by source | EVIDENCE REQUIRED |
| Idempotency key | Must prevent duplicate tasks for same logical batch+checklist | Current: org+template+batch_reference; future source-event key EVIDENCE REQUIRED |
| Source-of-truth ownership | Which system owns batch lifecycle | EVIDENCE REQUIRED |
| Retry semantics | Safe retries must be idempotent | Required |
| Duplicate event behavior | Same version → return existing; different version → reject | Implemented for current identity |
| Update/cancellation semantics | How cancelled/closed batches affect tasks | EVIDENCE REQUIRED |
| Authentication | Machine identity for inbound events/API | EVIDENCE REQUIRED |
| Audit | Accept/reject/create/idempotent outcomes | Partial (task create/cancel events exist) |
| Failure handling | Operational owner for poison messages / mapping failures | EVIDENCE REQUIRED |

## Phase 07F adapter boundary (technical — live contract still required)

Internal service boundary (no live connector):

| Field | Required | Notes |
| --- | --- | --- |
| `source_system` | Yes | Opaque configured label |
| `source_event_id` | Yes | Idempotency with `source_system` |
| `external_batch_id` | Yes | Becomes `batch_reference` |
| `external_organization_key` | Yes | Mapped via `ExternalBatchMapping` |
| `external_product_key` / `external_site_key` / `external_shift_key` | Optional | Mapped when supplied |
| `external_line_key` | Optional | Opaque only — Line master EVIDENCE REQUIRED |

Code: `apps.scheduling.batch_events` / `accept_external_batch_event`  
See [PHASE_07F_BATCH_EVENT_TASK_GENERATION.md](../business/PHASE_07F_BATCH_EVENT_TASK_GENERATION.md).

**STATUS: PHASE 07F LIVE BATCH CONTRACT REQUIRED** — APR-011 remains EVIDENCE REQUIRED. No webhook, polling, or Bileeta credentials.

## Explicit non-implementation (Phase 07B/07F)

- Live Bileeta/ERP HTTP client (Phase 17 still blocked — see ADR-029)
- No webhook endpoint inventing vendor paths
- No polling worker against invented URLs
- No Celery ingestion of production batch events from live vendor
- No ProductionBatch model
- No invented Bileeta/ERP endpoints or credentials

Phase 17 adds `apps.integrations` **contracts/mocks only**. See [BILEETA_VENDOR_EVIDENCE_REGISTER.md](BILEETA_VENDOR_EVIDENCE_REGISTER.md).

**STATUS: PHASE 17 BLOCKED — VENDOR API EVIDENCE REQUIRED**

## Observability expectations (future)

Log/audit categories (no secrets / no full auth headers):

- source received
- request accepted / rejected
- task created / idempotent return
- mapping failure
- authorization / configuration failure
- duplicate / version conflict
- retry outcome

Reuse `CHECKLIST_TASK_CREATED` when a task is actually created.
