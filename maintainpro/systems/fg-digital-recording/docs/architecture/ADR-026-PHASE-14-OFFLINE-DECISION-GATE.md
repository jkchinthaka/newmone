# ADR-026 — Phase 14 offline decision gate (online-only retained)

**Status:** Accepted (phase gate)  
**Date:** 2026-08-10  
**Phase:** 14

## Context

Phase 14 may add controlled offline checklist drafts (IndexedDB + sync) only after an explicit evidence review. Premature offline sync risks duplicate submissions, stale drafts, sensitive data on shared devices, and silent overwrite of newer server state.

## Evidence review (repository)

| Input | Repository finding | Status |
| --- | --- | --- |
| Wi-Fi survey / coverage in recording areas | No survey artefact; [APR-031](../governance/APPROVAL_REGISTER.md), [ASM-010](../business/ASSUMPTION_REGISTER.md) | **EVIDENCE REQUIRED** |
| Factory network reliability / expected outage duration | No measured outage profile; BC draft assumes paper fallback for MVP | **EVIDENCE REQUIRED** |
| Device plan (ownership, MDM, shared devices) | [APR-030](../governance/APPROVAL_REGISTER.md), [ASM-009](../business/ASSUMPTION_REGISTER.md) | **DECISION / EVIDENCE REQUIRED** |
| Device hygiene in production areas | [APR-032](../governance/APPROVAL_REGISTER.md), [ASM-011](../business/ASSUMPTION_REGISTER.md) | **EVIDENCE REQUIRED** |
| Hosting architecture (non-local) | Local Compose only; [APR-021](../governance/APPROVAL_REGISTER.md) | **EVIDENCE REQUIRED** |
| Offline requirement vs online MVP | [APR-022](../governance/APPROVAL_REGISTER.md): *Online MVP assumed until decided*; [DL-046](../governance/DECISION_LOG.md) open | **EVIDENCE REQUIRED** |
| Security requirements for cached drafts | No owner-approved offline retention / logout wipe policy | **EVIDENCE REQUIRED** |
| Standing technical direction | [ADR-003](ADR-003-RESPONSIVE-PWA.md): MVP recording remains online; offline later with sync controls | Retained |
| MVP scope | [MVP_SCOPE.md](../requirements/MVP_SCOPE.md): online-only operator submission; offline sync is an MVP non-goal | Retained |
| Phase 08C hardening | Online autosave / session recovery only — not IndexedDB | Retained |

## Decision

1. **Do not implement** IndexedDB offline drafts, service-worker sync queues, or offline PWA recording capability in Phase 14 at this time.
2. Retain the **online-only MVP assumption** (APR-022 notes) with **paper fallback** for sustained network loss ([BUSINESS_CONTINUITY_DRAFT.md](../operations/BUSINESS_CONTINUITY_DRAFT.md)).
3. Continue Phase 08C **online** autosave / optimistic concurrency / session recovery — not a substitute for offline IndexedDB.
4. Re-open Phase 14 implementation only after IT + Production + QA clear **APR-022** with supporting Wi-Fi (APR-031), device (APR-030), hygiene (APR-032), and security evidence.

## Explicit non-claims

- This gate does **not** assert that factory Wi-Fi is proven sufficient for pilot (ASM-010 remains EVIDENCE REQUIRED).
- This gate does **not** approve production go-live or skip paper fallback planning.
- Silence from owners is **not** approval to build offline sync.

## Safe scope if Phase 14 is later reopened (reminder only)

Maximum default safe scope (still requires APR-022): assigned checklist definitions, draft responses, pending draft sync. **Out of scope unless separately approved:** QA RELEASE, HOLD resolution, REJECT, role changes, specification changes, checklist publication.

## Consequences

- No offline client code, migrations, or sync endpoints in this phase.
- Risk RSK-G-009 / RSK-004 remain open until surveys and APR-022 close.
- Operators experiencing network loss use approved continuity procedures (paper), not unapproved digital offline workarounds.

## References

- [PHASE_14_OFFLINE_DECISION_GATE.md](../business/PHASE_14_OFFLINE_DECISION_GATE.md)
- ADR-003; APR-022 / 030 / 031 / 032; ASM-009 / 010 / 011
