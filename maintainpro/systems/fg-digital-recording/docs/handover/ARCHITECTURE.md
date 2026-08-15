# Architecture

## Baseline

The system is implemented as a modular monolith. Core technical direction remains:

- Django 5.2 LTS backend
- PostgreSQL as authoritative operational data store
- Redis for cache and Celery
- Django Templates, HTMX, Tailwind CSS
- Optional local AI assistance only, default OFF

This package does not change the approved baseline. See [../PROJECT_STATUS.md](../PROJECT_STATUS.md) and [../ROADMAP.md](../ROADMAP.md).

## Architectural principles

- Business logic belongs in services and domain workflows
- Authorization is deny-by-default and server-side
- Multi-record operations use transactions
- Submitted and approved records are preserved, not edited in place
- Corrections use amendment-style history
- Audit events are required for important operations
- ERP availability must not be required for factory-floor recording
- AI must not make final food-safety, QA, loading-release, CAPA-closure, or access-control decisions

## Major layers

| Layer | Purpose |
| --- | --- |
| UI | Django Templates, HTMX interactions, Tailwind assets |
| Application services | Domain services per app and phase |
| Domain modules | RBAC, products, checklists, scheduling, recording, review, QA, evidence, quality extensions |
| Persistence | PostgreSQL with relational integrity |
| Async/supporting services | Redis, Celery, notification delivery, reporting jobs |
| Integration boundary | `apps.integrations` contracts, mocks, dead-letter, reconciliation |

## Core data flow

1. Checklist definitions are versioned in `checklists`.
2. Task orchestration occurs in `scheduling`.
3. Operator recording and immutable submissions occur in `recording`.
4. Supervisor review and correction occur in `reviews` plus `recording`.
5. QA disposition occurs in `quality`.
6. Supporting modules add evidence, NCR/HOLD/CAPA, reporting, integration boundaries, and specialized quality domains.

## Scope boundaries

- PostgreSQL is the system of record
- MongoDB is not part of the default application architecture
- Live ERP/Bileeta integration is not implemented
- Offline/PWA capability is not implemented for the MVP
- Production architecture is not approved

## Architectural reference set

- [../architecture/ADR-001-MODULAR-MONOLITH.md](../architecture/ADR-001-MODULAR-MONOLITH.md)
- [../architecture/ADR-002-POSTGRESQL-PRIMARY-DATABASE.md](../architecture/ADR-002-POSTGRESQL-PRIMARY-DATABASE.md)
- [../architecture/ADR-018-DATABASE-PLATFORM-MONGODB-ASSESSMENT.md](../architecture/ADR-018-DATABASE-PLATFORM-MONGODB-ASSESSMENT.md)
- [../architecture/ADR-019-CHECKLIST-ENGINE-V2-ARCHITECTURE.md](../architecture/ADR-019-CHECKLIST-ENGINE-V2-ARCHITECTURE.md)
- [../architecture/ADR-022-CHECKLIST-WORKFLOW-LIFECYCLE.md](../architecture/ADR-022-CHECKLIST-WORKFLOW-LIFECYCLE.md)
- [../architecture/ADR-029-ERP-BILEETA-INTEGRATION-BOUNDARY.md](../architecture/ADR-029-ERP-BILEETA-INTEGRATION-BOUNDARY.md)
- [../architecture/ADR-031-PRODUCTION-READINESS-CONTROLS.md](../architecture/ADR-031-PRODUCTION-READINESS-CONTROLS.md)
- [../architecture/MODULE_MAP.md](../architecture/MODULE_MAP.md)

## Handover interpretation

For handover purposes, the architecture should be treated as technically rich but operationally evidence-gated. The next engineer should assume that missing business artifacts are blockers, not optional polish.
