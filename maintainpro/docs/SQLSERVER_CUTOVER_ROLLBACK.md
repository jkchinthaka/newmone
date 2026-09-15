# SQL Server Cutover Rollback

## Principles

- Mongo remains authoritative **source** until cutover sign-off
- No default dual-write
- Prefer fail-closed: stop writes → restore prior release → investigate

## If cutover fails

1. **Stop writes** — take API read-only or offline; freeze schedulers/PM generators
2. **Retain Mongo source** — do not delete or overwrite Mongo snapshot/backup
3. **Return application** to previous Mongo-capable release (`maintainpro/integration-v1` Phase 14 tip or last known Mongo build)
4. **Point `DATABASE_URL`** back to Mongo connection string; set `DATABASE_PROVIDER=mongodb` if required by that release
5. **Reconcile SQL-only writes** — if cutover allowed any SQL writes, export and decide replay vs discard (document IDs)
6. **Investigate** — migration logs, reconciliation mismatches, FK failures
7. **Retry** only after written sign-off and fresh dry-run/rehearsal

## Rollback artifacts to keep

- Mongo dump / snapshot taken **before** freeze
- SQL backup taken immediately before app cutover (if SQL already seeded)
- Migration dry-run + apply reports
- Git SHA of SQL release vs Mongo release

## What not to do

- Do not force-push historical Phase 8–14 branches
- Do not merge Phase 15 to `main` during a failed cutover
- Do not invent dual-write to “fix” inconsistency without an approved design
