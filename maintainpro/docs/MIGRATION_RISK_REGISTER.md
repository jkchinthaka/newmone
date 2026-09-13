# Migration Risk Register (Phase 0)

**Baseline:** `origin/main` @ `290bf3a`

| ID | Risk | Severity | Probability | Mitigation | Phase |
|----|------|----------|-------------|------------|-------|
| R01 | Data loss from premature model drops | Critical | Med | No drops until Phase 14 + backup/restore proof | 0 / 14 |
| R02 | Schema migration breaks tenants | Critical | Med | Forward-only changes; nullable→required with backfill | 2–7 |
| R03 | Tenant isolation regression (`MaintenanceSchedule` lacks tenantId) | Critical | Med | Add tenantId; fail-closed `requireTenantId`; CI tenant audit | 2 / 8 |
| R04 | Vehicle/Asset dual register conflicts | High | High | Decide spine; link FK; single meter source | 2 / 10 |
| R05 | Old seeded roles break after collapse | High | High | Alias map; permission packs first; dual-run | 12 |
| R06 | Mobile decommission before PWA parity | High | High | Freeze Flutter; PWA field UAT first | 1 / 13 |
| R07 | ERP mock treated as production stock truth | High | Med | Keep mode gates; never report mock as prod success | 9 / 14 |
| R08 | Historical reports break when modules hidden | Med | Med | Keep APIs read-only; document retired surfaces | 1 |
| R09 | Direct URL access to hidden pages | High | Med | Keep guards; optional deny middleware for retired routes | 1 |
| R10 | Nav removed but APIs still depend on modules | Med | High | Retire UI first; keep modules until Phase 14 | 1 |
| R11 | Production data in farm/cleaning/go-live models | High | Med | Export before drop; retain until confirmed unused | 14 |
| R12 | Stale tests asserting retired nav | Med | High | Update tests with Phase 1 | 1 |
| R13 | Backup/restore not drilled | Critical | Med | Follow backup runbooks; non-prod restore evidence | 14 |
| R14 | External credentials unavailable (Bileeta/SMTP) | High | High | Env-gated; honest readiness; no fake success | 9 / 14 |
| R15 | Feature branches 8–14 diverge from Phase 0/1 on main | Med | High | Integrate via PR order; rebase carefully | ongoing |
| R16 | FG SSO handoff broken if `/fg` routes deleted | High | Med | Keep SSO bridge; hide UI only | 1 |

---

## Backup note

Before any destructive production migration:

1. Verify dual-DB / Atlas backup.  
2. Restore to disposable environment.  
3. Record evidence in go-live backup docs.  
4. Only then apply drops.

Phase 0 does **not** perform backups itself (operator-owned), but documents the requirement.
