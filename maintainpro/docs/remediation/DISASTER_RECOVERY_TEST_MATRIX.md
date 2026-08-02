# Disaster Recovery Test Matrix

**Phase:** 6A  
**Rule:** No mandatory test may `skip`.  
**Runtime status:** CONTRACT_DEFINED until `RECOVERY_RUNTIME_VALIDATED` workflow evidence exists.

## E2E recovery rehearsal (mandatory)

| ID | Assertion |
| --- | --- |
| DR-E2E-001 | Source safety guard passes (`validate-recovery-target.mjs`) |
| DR-E2E-002 | Mongo backup created from disposable source |
| DR-E2E-003 | Safe manifest created (`schemaVersion` 1.0) |
| DR-E2E-004 | Archive checksum passes |
| DR-E2E-005 | Corrupted archive rejected before restore |
| DR-E2E-006 | Fresh target required (`maintainpro_restore_*`, not pre-existing) |
| DR-E2E-007 | Restore completes without `--drop` |
| DR-E2E-008 | Required collection counts reconcile |
| DR-E2E-009 | Restored relationships pass (tenant/user/WO/inventory/PO coherence) |
| DR-E2E-010 | Recovery API boots against restored DB |
| DR-E2E-011 | Restored disposable login passes |
| DR-E2E-012 | Restored work-order read passes |
| DR-E2E-013 | Restored inventory read passes |
| DR-E2E-014 | Restored PO/GRN read passes |
| DR-E2E-015 | Restored dashboard read passes |
| DR-E2E-016 | Object backup manifest created (E2E bucket) |
| DR-E2E-017 | Object restore checksums reconcile |
| DR-E2E-018 | Replication and backup statuses remain separate in readiness |
| DR-E2E-019 | Raw archive is not uploaded to CI artifacts |
| DR-E2E-020 | Cleanup preserves Docker volumes (`down --remove-orphans` only) |
| DR-E2E-021 | No production-like target accepted (forbidden DB names / public hosts) |
| DR-E2E-022 | No database drop/reset command in recovery scripts |
| DR-E2E-023 | No secret appears in logs or manifests |
| DR-E2E-024 | Recovery duration metadata recorded (E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE) |
| DR-E2E-025 | Tenant isolation survives restore |

## Integrity tests

| ID | Assertion |
| --- | --- |
| DR-INTEGRITY-001 | Valid archive checksum passes |
| DR-INTEGRITY-002 | Changed archive checksum fails |
| DR-INTEGRITY-003 | Zero-byte archive fails |
| DR-INTEGRITY-004 | Missing manifest fails |
| DR-INTEGRITY-005 | Mismatched backup ID fails |
| DR-INTEGRITY-006 | Restore cannot start before integrity verification |

## Object storage tests

| ID | Assertion |
| --- | --- |
| DR-OBJECT-001 | Object manifest created |
| DR-OBJECT-002 | Restore bucket is fresh |
| DR-OBJECT-003 | Object count matches |
| DR-OBJECT-004 | Checksums match |
| DR-OBJECT-005 | Missing object fails verification |
| DR-OBJECT-006 | Modified object fails verification |
| DR-OBJECT-007 | No bucket deletion command exists in recovery scripts |

## Safety validator cross-reference

`validate:recovery-safety` — RECOVERY-SAFE-001..012 (see `scripts/validate-recovery-safety.mjs`).

## Gate placement (Full-Stack E2E)

Execute after seed and business gates, before full Playwright suite:

1. Backup → manifest → corruption reject → fresh restore → recovery API smoke → object backup/restore → full suite.

## Evidence

Record results in `FULL_STACK_E2E_RUNTIME_EVIDENCE.md` with tested application SHA only after success. Preserve Phase 5B/5C/5D SHAs in all summary docs.
