# ADR-041 — Packaging label / artwork verification foundation

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 29

## Context

Packaging QA, Product Master, Document Control, and Production Engineering need controlled artwork / label verification against approved versions — without inventing shelf life, date-code formulas, customer label rules, or artwork catalogue numbers.

## Decision

1. Introduce `apps.packaging` with versioned `PackagingArtwork` / `ArtworkVersion` linked to `FGProduct`, opaque pack-configuration labels, effective dates, approval references, and optional evidence object keys.
2. Date-coding architecture stores recorded MFG/EXP/batch values and opaque format/rule references only — **no shelf-life calculation**.
3. `ChecklistItemArtworkBinding` binds a checklist item to an exact **APPROVED** artwork version and freezes context for historical submissions.
4. `LineClearanceArtworkHook` prepares a future changeover / line-clearance association only — not a clearance workflow.
5. `ArtworkVerificationRecord` preserves batch verification results and frozen artwork identity (PROTECT FK + JSON freeze).
6. Authorization separates Product Master `manage_packagingartwork` from Document Control `approve_packagingartwork`; read-only uses `view_packaging`.

## Consequences

- Company artwork catalogues, date-code formulas, shelf-life rules, and customer label policies remain **EVIDENCE REQUIRED** (APR-055).
- Wrong observed artwork version is recorded as a match decision (`WRONG_ARTWORK_VERSION`) — not a QA disposition.
- Line-clearance execution remains future work until company SOP is evidenced.
