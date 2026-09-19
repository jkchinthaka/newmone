# Final Acceptance — Known Issues & External Blockers

## Verdict (this branch)

**HANDOVER VALIDATION INCOMPLETE**

Repository-owned P1 defects found during acceptance were fixed (RBAC alias/seed, SQL Server filtered unique for request/issue→WO). Flagship Request→WO journey and Action Center aggregates are proven UI=API=SQL. Full matrix of forms/roles/backup/fresh-DB/scale/PWA/a11y remains incomplete.

## External / operator blockers

| Item | Label |
|------|-------|
| Bileeta ERP live credentials | EXTERNAL BLOCKER |
| Entra ID | EXTERNAL BLOCKER |
| SMTP / SMS | EXTERNAL BLOCKER |
| Power BI RLS | EXTERNAL BLOCKER |
| Vercel deploy credentials | EXTERNAL BLOCKER |
| Cloudflare Workers deploy credentials | EXTERNAL BLOCKER |
| Production DNS / cutover | OPERATOR ACTION REQUIRED |
| Human UAT sign-off | OPERATOR ACTION REQUIRED |

## Repository-owned remaining work (high level)

- Complete WO lifecycle + PM + inventory stock-count UI→SQL proofs
- Fresh empty DB + upgrade + backup/restore rehearsal evidence pack
- Action Center queue aggregate latency (1611ms) plan-backed optimization
- Exhaustive form/button matrix across 192 routes
- WCAG 2.2 AA critical-flow audit
- Production-build PWA offline replay
