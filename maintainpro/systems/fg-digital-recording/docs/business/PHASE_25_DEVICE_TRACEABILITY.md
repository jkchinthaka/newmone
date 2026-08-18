# Phase 25 — Measurement Device Traceability

**Document status:** Technical foundation — calibration WARN/BLOCK remains company policy  
**Phase:** 25  
**Depends on:** Phase 05D equipment/calibration foundation  

## Delivered

| Area | Status |
| --- | --- |
| Device reference on measurement responses | TECHNICALLY SUPPORTED |
| Frozen device + calibration snapshot | TECHNICALLY SUPPORTED |
| Eligibility (org / site / active / type) | TECHNICALLY SUPPORTED |
| Enforcement OFF / WARN / BLOCK settings | Default **OFF** |
| Override (gated + audited) | OFF until `INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED` |
| Calibration certificate evidence kind | `CALIBRATION_CERTIFICATE` |
| Operator UI device select with fitness label | Compact select — no dashboard clutter |

## Not delivered / EVIDENCE REQUIRED

- Company production WARN vs BLOCK decision (APR-051)
- Invented calibration intervals or auto due windows beyond stored `next_due_on`
- Automatic QA disposition from overdue devices

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `INSTRUMENTS_CALIBRATION_ENFORCEMENT` | `OFF` | `OFF` / `WARN` / `BLOCK` |
| `INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED` | `false` | Allows audited override of BLOCK |

## STATUS: PHASE 25 DEVICE TRACEABILITY COMPLETE
