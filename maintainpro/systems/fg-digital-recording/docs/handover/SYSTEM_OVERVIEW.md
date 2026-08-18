# System Overview

## Summary

The Nelna FG Digital Recording System is a modular Django monolith for finished-goods quality recording, review, auditability, and related quality workflows. The implementation baseline is broad, but business activation remains gated by evidence and approvals.

## What the system is

- Backend: Django 5.2 on Python 3.13.x
- Data store: PostgreSQL as the authoritative system of record
- Async/cache: Redis and Celery
- UI: Django Templates, HTMX, Tailwind CSS
- Local runtime: host `uv` plus Docker Compose for PostgreSQL and Redis

## What the system is not

- Not production-ready
- Not UAT-passed
- Not approved to replace paper
- Not authorized for live ERP or Bileeta integration
- Not approved for MongoDB cutover

## Implemented capability areas

Current Django apps cover:

- identity and scoped RBAC
- organization and shift foundations
- product and specification foundations
- checklist definition, versioning, and task scheduling
- operator recording and immutable submission
- supervisor review and correction
- QA manual disposition
- evidence, NCR/HOLD/CAPA, dispatch, notifications, reporting
- ERP boundary mocks/contracts
- optional safe AI foundation
- lab, HACCP, sampling, device traceability, sanitation, environmental, packaging, changeover
- receiving, supplier quality, IQC, IPQC, batch dossier, genealogy, recall, complaints, returns

See [MODULE_GUIDE.md](MODULE_GUIDE.md) and [../PROJECT_STATUS.md](../PROJECT_STATUS.md).

## Workflow summary

At the currently implemented core:

1. A checklist task is created from approved technical pathways.
2. An operator records draft data and submits an immutable snapshot.
3. A supervisor reviews or returns the submission for correction.
4. QA performs a final in-app manual disposition of `RELEASE`, `HOLD`, or `REJECT`.

Those labels do not automatically drive ERP, warehouse, dispatch, or product-release side effects.

## Authoritative status references

- Canonical status: [../PROJECT_STATUS.md](../PROJECT_STATUS.md)
- Roadmap and phase intent: [../ROADMAP.md](../ROADMAP.md)
- UAT package: [../uat/README.md](../uat/README.md)
- Release gate: [../release/PHASE_21_FINAL_REPORT.md](../release/PHASE_21_FINAL_REPORT.md)
- Continuity baseline: [../operations/CONTINUITY_AND_HANDOVER_PLAN.md](../operations/CONTINUITY_AND_HANDOVER_PLAN.md)

## Current operational posture

- Local developer workflow is supported
- Technical foundations through Phase 40 exist on `main`
- Production use is blocked by missing business evidence, UAT execution, hosting approval, security signoff, restore-governance closure, and support ownership

## Immediate handover message

Treat this repository as an advanced technical baseline with open business gates, not as a production-approved finished system.
