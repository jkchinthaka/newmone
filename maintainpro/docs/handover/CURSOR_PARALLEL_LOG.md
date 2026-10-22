# Cursor parallel log

## 2026-10-22 — production local evidence disk

- Branch `fix/evidence-local-disk`; base `origin/develop` = `658ae0c2609fa50566925c277784f830e63650fe`.
- Isolated worktree: `C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.evidence-local-disk`; app in `maintainpro/`.
- Owner explicitly authorized this new branch/task after the previous session stopped on the original checkout's handover mismatch. AI_SESSION_HANDOVER.md is excluded by the current task and is untouched.
- Implemented opt-in production local storage, private absolute-root validation, write/delete + capacity readiness probes, safe UUID/MIME object layout, traversal/junction checks, streaming/provider size cap, signature checks. Existing terminal locks and idempotency preserved; SHA-256 added after review found it absent from the baseline.
- Ops runbook and backup mirror updated; upload-path inventory records asset-document and inspection follow-ups explicitly.
- Tests so far: API tsc 0 after private dependency correction; web tsc 0; 8 targeted Jest suites / 57 tests passed; tenant audit unapproved 0; RBAC 971 routes / violations 0. Initial env-test fixture failed on unrelated default mock integrations; fixed fixture to disabled ERP/billing, rerun passed. Initial API tsc used stale shared generated Prisma types; copied an existing current generated client into this worktree's ignored node_modules only. No schema change, migration, regeneration of shared client or database access.
- Remaining: final checks after last safety additions, independent qa-reviewer, commit/push branch, PR to develop (do not merge).
- No stack started, no listeners changed, no production server configuration changed. Excluded files untouched. No merge, tag, force-push, or main push.

Review correction: the baseline had byte equality checks, not SHA-256. This change adds SHA-256 sidecars for new files and verifies them on confirmation/download via provider reads. Legacy `evidence/` keys without a checksum remain readable; no automatic rewrite/backfill. Sidecars must be backed up and restored with content. Checksums detect byte corruption, not a malicious service account rewriting both files. No excluded schema change is needed.

Final verification: independent qa-reviewer PASS after fixing install-root detection without .git. Targeted Jest: 11 suites / 77 tests PASS (including production env opt-in, path rules, write failure, low disk warning, byte round-trip, checksum corruption, closed/cancelled 400, tenant download 404, health/deployment regressions). API and web tsc exit 0; tenant audit unapproved 0; RBAC 971 routes / violations 0. Backup PowerShell parse errors 0; backup/restore not executed. No database tests, Docker or live production deployment. No temporary 3060/3061 listeners found. Next: commit and push feature branch, open non-draft PR to develop, do not merge.

Delivery: implementation committed as `f7f75f14` and pushed only to `origin/fix/evidence-local-disk`. Non-draft PR https://github.com/jkchinthaka/newmone/pull/128 targets `develop`; no merge or auto-merge requested. Independent QA PASS and local gates recorded above; GitHub CI results are not claimed. This log-only checkpoint records delivery. Exact next action: owner reviews PR #128 and schedules production configuration/deployment separately. Production server and existing stacks remain unchanged.

## 2026-10-22 — asset documents and inspection evidence on the private disk

fix/asset-inspection-storage | DONE | fix/asset-inspection-storage | 3e2cba16 | https://github.com/jkchinthaka/newmone/pull/132 | API tsc 0; web tsc 0; web unit 367/0; Jest asset-inspection-storage 8 plus related evidence/planning 70; tenant unapproved 0; RBAC 972/0 | Stacked on #128 because that PR is still open. Local configured storage uses the work-order provider for new asset documents and inspection evidence. Non-local behaviour and existing records stay readable. No schema change, no database writes, no Docker, 3040/3041 untouched. Review export: docs/handover/review/asset-inspection-storage.md.
