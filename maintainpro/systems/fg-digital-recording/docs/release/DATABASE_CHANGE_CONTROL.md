# Phase 21 — Database change control

| Control | Status |
| --- | --- |
| Backup before risky migration | Required for production; **N/A** — no production DB |
| Schema/index validation | Technical migrations exist in repo; production apply **BLOCKED** |
| Rollback / forward-fix plan | Document per migration at release time — **NOT EXECUTED** |
| SoR | PostgreSQL (ADR-002) |

Non-prod restore drill evidence (technical): [../operations/RESTORE_DRILL_EVIDENCE.md](../operations/RESTORE_DRILL_EVIDENCE.md)
