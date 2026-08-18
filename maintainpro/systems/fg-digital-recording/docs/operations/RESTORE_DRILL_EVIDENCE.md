# Restore Drill Evidence — Phase 19

```text
RESTORE DRILL:
LOCAL / TEST ONLY
```

**Executed at (UTC):** 20260812T083504Z
**Source DB:** `nelna_fg` (local/non-production Compose)
**Scratch DB:** `nelna_fg_restore_drill` (dropped after verify)
**Marker id:** `phase19_restore_drill_20260812T083504Z`
**Dump SHA-256:** `d499596d780963126c789a5c5419739212b1af767d48da8d9c610bc35e051ef2`
**Client mode:** `docker:postgres`
**Result:** PASS (verify count=1)

## Scope

- PostgreSQL logical dump/restore only in this drill
- Evidence object storage restore is a separate operator procedure
- MongoDB SoR restore is N/A (PostgreSQL is primary SoR per ADR-002)

## Script fix applied this package

psql `:'variable'` substitution failed under `docker compose exec` on Windows.
Drill now uses `_require_ident`-validated literals only. Scratch DB is dropped after successful verify.

## Notes

Operator must retain dump checksums in the company-approved backup vault.
RPO/RTO remain **COMPANY DECISION REQUIRED**.
This PASS is technical evidence — **not** production DR or go-live approval.
