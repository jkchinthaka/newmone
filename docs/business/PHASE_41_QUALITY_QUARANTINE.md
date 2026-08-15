# Phase 41 — Quality Quarantine Management

**Status:** Technical foundation complete  
**ADR:** [ADR-052](../architecture/ADR-052-QUALITY-QUARANTINE-MANAGEMENT.md)  
**Approval gate:** APR-066 (quarantine release / quantity / ERP sync — EVIDENCE REQUIRED)

## Scope delivered

- Application-side quarantine records (batch/sub-lot, source, reason, owner, status, resolution)
- Source kinds: QA HOLD, returned product, incoming inspection, lab pending, NCR, manual
- Quantity/UOM references gated by org policy (not an inventory ledger)
- ERP sync status tracking (NOT_SENT / PENDING / CONFIRMED / FAILED)
- Dual-gated release and ERP outbound OFF by default
- Append-only quarantine/resolution event history

## Explicitly not delivered / gated

- Company quarantine release SOP and authority matrix (APR-066)
- Quantity/UOM recording enablement as business policy (APR-066)
- Live ERP quarantine sync adapter (APR-066)
- Any claim that this module is the inventory ledger

## Tests

`apps/quality_quarantine/tests/test_phase41_quality_quarantine.py` — source
linkage, quantity, multiple cases, release authority, ERP status, cross-org,
immutability.

## STATUS: PHASE 41 QUARANTINE MANAGEMENT COMPLETE
