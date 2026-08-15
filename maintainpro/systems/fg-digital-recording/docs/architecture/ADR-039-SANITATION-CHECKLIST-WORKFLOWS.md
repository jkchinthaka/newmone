# ADR-039 — Sanitation / SSOP checklist workflows

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 27

## Context

Sanitation / SSOP activities must be digital without inventing cleaning chemicals, concentrations, frequencies, ATP/swab limits, or approval procedures. The product already has a configurable checklist engine, recurring scheduler, equipment references, evidence, and Supervisor/QA review chains.

## Decision

1. Introduce `apps.sanitation` as **program shells** that bind to existing `ChecklistTemplate` rows — no separate hardcoded sanitation form engine.
2. Configurable `SanitationScope` associates programs with site, department, opaque line/work-area codes, and optional equipment.
3. Schedule intents (`PRE_OP` / `POST_OP` / `SHIFT` / `DAILY` / `PERIODIC`) link to existing `ChecklistSchedule` configuration; frequencies remain on the scheduler and are not seeded.
4. `ChemicalReference` is an unseeded generic master (opaque concentration label only).
5. `SanitationVerificationMode` selects which **existing** workflows apply (`SELF_CHECK`, `SUPERVISOR`, `QA`) — it does not invent SSOP approval steps.
6. FAIL does not stop production unless both org `SanitationFailPolicy.policy_enabled` and `SANITATION_FAIL_STOP_PRODUCTION_APPROVED` are true (default OFF).
7. Frozen `sanitation_context` is retained on checklist template bindings and copied into submission control-point snapshots for history.

## Consequences

- Company SSOP content and production-stop policy remain **EVIDENCE REQUIRED** (APR-053).
- Operator recording continues through the shared recording/review apps.
