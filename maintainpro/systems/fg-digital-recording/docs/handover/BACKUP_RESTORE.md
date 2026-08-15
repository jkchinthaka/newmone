# Backup Restore

## Status

Technical backup and restore documentation exists. Production backup custody, RPO, and RTO remain unresolved.

## Authoritative sources

- [../operations/BACKUP_RESTORE_RUNBOOK.md](../operations/BACKUP_RESTORE_RUNBOOK.md)
- [../operations/RESTORE_DRILL_EVIDENCE.md](../operations/RESTORE_DRILL_EVIDENCE.md)
- [../operations/DR_RUNBOOK.md](../operations/DR_RUNBOOK.md)
- [../operations/CONTINUITY_AND_HANDOVER_PLAN.md](../operations/CONTINUITY_AND_HANDOVER_PLAN.md)

## Current evidence-based position

- PostgreSQL is the system of record and is the primary backup target
- evidence files require separate operational backup handling
- a non-production restore drill is documented as PASS
- that restore evidence does not equal production go-live approval

## RPO / RTO

- `EVIDENCE REQUIRED`
- `DECISION REQUIRED`

The repository explicitly keeps RPO and RTO as company-owned decisions. Do not infer them from the existence of scripts or runbooks.

## MongoDB note

MongoDB is not the system of record. If a MongoDB POC environment exists, treat it as optional lab data only, not as the authoritative backup scope.

## Handover actions

1. Review the backup scripts and custody assumptions in the Phase 19 runbook.
2. Confirm company-approved operators and storage locations.
3. Confirm RPO and RTO in writing.
4. Repeat restore evidence in the target non-production environment before any production-readiness claim.
