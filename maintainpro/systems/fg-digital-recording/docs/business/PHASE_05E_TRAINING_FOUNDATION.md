# Phase 05E — Operator Training / Competency Foundation

**Document status:** Technical foundation — **not** a company training matrix  
**Phase:** 05E

## Scope

Generic `apps.training` records so future controlled checklist access can optionally require evidenced competency.

## Explicit non-goals / open items

| Topic | Status |
| --- | --- |
| Company training matrix / course catalogue | **EVIDENCE REQUIRED** (APR-042) |
| Automatic recording WARN/BLOCK on missing/expired training | **OFF by default** — policy modes exist; not enforced on recording yet |
| Evidence file attachments | Deferred (object storage) — reference fields only |
| Seeded training rows | **None** |

## Training record

- Org-scoped; subject user; course code/name; optional expiry; trainer/evidence references
- Competency scope: `GENERAL` / `CHECKLIST` / `PROCESS` / `EQUIPMENT` / `BUSINESS_ROLE` (associations only where required)
- Status: `ACTIVE` / `SUPERSEDED` / `VOID` — hard delete refused
- Currency labels: `VALID` / `FUTURE` / `EXPIRED` / `INACTIVE` (derived; not a gate)

## Enforcement policy

`TrainingEnforcementPolicy.gate_mode`: `OFF` (default) / `WARN` / `BLOCK`  
Phase 05E stores the mode only. Recording does **not** auto-block.

## Authorization

- `training.view_trainingrecord`
- `training.manage_trainingrecord`  
Separated from operator `scheduling.record_checklisttask`.

## Audit

`TRAINING_RECORD_CREATED` / `UPDATED` / `STATUS_CHANGED`; `TRAINING_ENFORCEMENT_POLICY_CREATED` / `UPDATED`.

## Owner / evidence

- Real training matrix and gate policy: **OWNER REQUIRED** / **EVIDENCE REQUIRED** (APR-042)
