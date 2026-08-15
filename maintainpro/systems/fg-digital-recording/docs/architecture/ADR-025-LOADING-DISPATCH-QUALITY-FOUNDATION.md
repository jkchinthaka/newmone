# ADR-025 — Loading and dispatch quality foundation

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 13

## Context

Loading/dispatch quality recording must support vehicle inspection, cold-chain temperatures, quantity reconciliation, and optional QA RELEASE gating without inventing Nelna temperature limits, release catalogues, or ERP inventory behaviour. AI must never authorize or block loading.

## Decision

1. Introduce `apps.dispatch` with `DispatchQualityRecord` as the loading/dispatch quality bounded context (covers MODULE_MAP `loading` + `dispatch` for Phase 13 foundation).
2. Vehicle hygiene / pre-cooling checks link to dynamic `ChecklistVersion` / `ChecklistSubmission` — no hardcoded inspection questions.
3. Cold-chain readings store Decimal °C + optional device/equipment references — **no allowable temperature limits**.
4. Quantity lines capture released / loaded / remaining (derived) — **not** an ERP inventory ledger; **no ERP writes** (Phase 17 contract required later).
5. `DispatchReleasePolicy.require_qa_release_before_loading` defaults **False**. When enabled (owner evidence / APR-017), completion requires linked `QAReview` with decision `RELEASE`. AI suggestions never drive the gate.
6. Traceability via batch/sub-lot references and optional QA review link; append-only history + security audit events.
7. Soft retention; separate create / manage / complete / policy permissions.

## Consequences

- Production release-before-loading remains EVIDENCE REQUIRED until Dispatch + QA owners approve enabling the policy.
- Temperature acceptance criteria remain EVIDENCE REQUIRED.
- Separate physical `loading` app may be introduced later if owners require split bounded contexts.
