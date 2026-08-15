# MVP Scope — Nelna FG Digital Recording System

**Document status:** Proposed — requires business and QA approval  
**Phase:** 00 — Discovery and governance  
**Last updated:** 2026-08-04

This document separates proposed Phase 1 MVP from later work. Nothing here is approved business fact until owners sign off.

## Phase 1 MVP (proposed)

Narrow MVP intended to prove safe digital recording for a limited pilot:

| Capability | Notes |
| --- | --- |
| Authentication | Individual named accounts; session-based browser auth (proposed) |
| Scoped RBAC | Deny-by-default roles scoped to confirmed organization units |
| Organization hierarchy | Minimal hierarchy sufficient for pilot scoping (structure TBC) |
| Minimal master data | Only entities required by the two approved checklist types |
| Two approved checklist types | Exact forms **EVIDENCE REQUIRED** / owner approval required |
| Task assignment | Assign and present due recording tasks to operators |
| Online operator submission | Online-only for MVP; Sinhala-capable operator UI |
| Supervisor checking | Check step with separation from submitter where required |
| QA verification | Verification step with policy enforcement |
| Evidence upload | Photos/files to object storage; metadata in PostgreSQL |
| Basic audit export | Export sufficient for pilot audit review |

**Approval status:** Proposed — not approved.

## Later phases (summary)

See [ROADMAP.md](../ROADMAP.md) for full phasing. Later work includes amendments maturity, NC/CAPA, loading/dispatch, offline PWA sync, notifications, broader reporting, ERP integration, optional local AI assistance, hardening, and production handover.

## Explicit non-goals (MVP)

- Native mobile apps
- Offline sync (design may start later; not MVP delivery)
- ERP integration as a dependency for recording
- Full CAPA / loading / dispatch suites
- Local AI features
- Multi-site enterprise rollout
- Claiming certification compliance solely by using the software

## Pilot scope (proposed)

- Limited users and devices (counts **OWNER REQUIRED**)
- One pilot context (site/line/area **DECISION REQUIRED**)
- Two checklist types only
- Parallel paper run as directed by QA
- Online connectivity assumed for MVP operator submission

## Production scope

Production scope is **not** defined as “MVP plus go-live.” Production requires:

- Completed applicable roadmap phases through pilot/UAT
- Restore testing, security review, and owner approval
- Approved business rules and trained administrators

Until then, the system is **not production-ready**.

## Mobile / PWA scope

- One responsive installable PWA for operators, supervisors, QA, admin, management, and auditor read-only access
- No separate native application in initial phases
- Native reconsideration only after pilot evidence shows PWA cannot meet required reliability

## AI scope

- MVP: no AI features
- Later: optional local AI assistance only
- AI never makes final food-safety, QA, loading-release, CAPA-closure, or access-control decisions

## ERP scope

- MVP: no ERP dependency for recording
- Later: integration only via approved APIs/contracts
- Never direct ERP database writes from this system

## Offline scope

- MVP: online submission only
- Later: IndexedDB drafts and sync queues (Phase 14)
- Offline design must address duplicate sync and lost-data risks before enablement

## Approval

| Item | Role | Status |
| --- | --- | --- |
| MVP capability list | Business owner | Pending |
| Two checklist types | QA owner / form owners | Pending — EVIDENCE REQUIRED |
| Pilot boundary | Business + QA + IT | Pending |
| Non-goals acceptance | Project owner | Pending |
