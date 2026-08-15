# ADR-038 — Foreign-body / metal-detector challenge foundation

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 26

## Context

Metal-detector challenge verification is a common FG CCP/OPRP control. The system must record device-linked challenge tests without inventing test-piece sizes, Fe/Non-Fe/SS limits, frequencies, or retrospective HOLD rules.

## Decision

1. `apps.foreign_body` provides TestPiece catalogue shells, MetalDetectorChallengeTest records, schedule-rule shells, and ContainmentAssessment architecture.
2. PASS/FAIL is deterministic from configured expected vs observed detection.
3. Device linkage uses Phase 05D Equipment; METAL_DETECTOR type required by default.
4. Auto-HOLD from FAIL defaults OFF (`FOREIGN_BODY_AUTO_HOLD_APPROVED=false`).
5. Soft retention: VOID instead of hard delete.
6. Record vs verify permissions are separated (SoD).

## Consequences

- APR-052 must approve production piece catalogues, frequencies, and containment/HOLD policy before enablement.
- Challenge FAIL never invents corrective actions; containment interval is advisory unless company policy enables HOLD.
