# Phase 14 — Offline PWA decision gate

**Status:** Gate complete — offline **not** implemented  
**Date:** 2026-08-10  
**ADR:** [ADR-026](../architecture/ADR-026-PHASE-14-OFFLINE-DECISION-GATE.md)

## Decision gate outcome

Offline requirement was evaluated against repository evidence **before** any IndexedDB / sync implementation.

| Required input | Result |
| --- | --- |
| Wi-Fi survey (APR-031 / ASM-010) | **Not received** — EVIDENCE REQUIRED |
| Factory network reliability / outage duration | **Not received** — EVIDENCE REQUIRED |
| Device plan (APR-030 / ASM-009) | **Not decided** — DECISION / EVIDENCE REQUIRED |
| Hosting architecture (APR-021) | Local Compose only — non-local **EVIDENCE REQUIRED** |
| Security requirements for cached drafts / logout wipe | **Not received** — EVIDENCE REQUIRED |
| APR-022 offline vs online MVP | **Open** — notes: *Online MVP assumed until decided* |

**Conclusion:** Insufficient owner evidence to justify offline sync. Standing MVP/architecture direction remains **online-only** recording with **paper fallback** for sustained outage. Phase 14 offline capability is **not implemented**.

## What was not built

- IndexedDB draft store / PWA service-worker sync
- Offline QA RELEASE / HOLD / REJECT / role / spec / publish paths
- Client draft ID sync queue / conflict protocol (deferred until APR-022)

## What remains in force

- Phase 08C online autosave, `draft_version` optimistic concurrency, online session recovery
- ADR-003: installable PWA is longer-term direction; offline still gated
- BUSINESS_CONTINUITY_DRAFT: network loss → paper for MVP

## Re-entry criteria (before any offline code)

1. Written APR-022 decision authorizing offline drafts for a named scope  
2. Wi-Fi / reliability evidence (APR-031) or accepted paper-fallback SLA  
3. Device ownership + hygiene evidence (APR-030 / APR-032)  
4. Logout / sensitive-cache wipe policy approved by IT + QA  
5. Test plan covering network loss, restart, duplicate sync, stale draft, version pin, conflict, logout, cross-user device switch  

## STATUS: PHASE 14 ONLINE ONLY APPROVED — OFFLINE NOT IMPLEMENTED
