# MaintainPro — Final Handover Report (Phase 2)

**Verdict:** HANDOVER READY — EXTERNAL PRODUCTION GATES PENDING

**Baseline SHA (PR #43 merge):** `ad4ec4e2612a43331ed13cc997ea050dd1cf2e17`
**Phase 2 merge SHA (PR #44):** `4c784d783e5893fd513dd71674fe32638aa75a6d`
**Responsive closeout merge SHA (PR #45):** `81cd53710179fadf9ea847541ce68c554d77ae4d`
**Evidence pack:** `docs/qa/`
**Date:** 2026-09-19

---

## Responsive visual closeout (production build)

**Method:** `next build` + `next start` on `:3011` with approved HTTP compat (`ALLOW_INSECURE_HTTP=true`, `COOKIE_SECURE=false`); authenticated Playwright audit via `scripts/verify-responsive-visual.mjs` + WO editor smoke `scripts/verify-responsive-wo-detail.mjs`.

| Widths / devices | Result |
|------------------|--------|
| 1920 desktop | PASS |
| 1366 laptop | PASS |
| 768 tablet | PASS |
| 390 mobile (+ short login 560vh) | PASS |

| Pages / surfaces audited | Result |
|--------------------------|--------|
| `/action-center`, `/requests`, `/requests/new`, `/work-orders` | PASS |
| Work-order editor modal (List Edit / mobile card) | PASS |
| `/assets`, `/inventory`, `/fleet`, `/fleet/gate` | PASS |
| `/approvals`, `/admin/work-permits` (safety), `/maintenance/reliability` | PASS |
| `/reports`, `/admin/users`, `/admin/maintenance-config` | PASS |
| Login short-viewport Sign-in reachability | PASS |

| Defects found / fixed | Fix |
|-----------------------|-----|
| `/assets` @768 — document horizontal overflow from `DataTable` `minWidth: 960px` escaping page scrollWidth | `[contain:paint]` + `min-w-0 max-w-full` on DataTable scroll wrappers; assets registry scroll region |
| Login short height — Sign-in below fold / clipped | `min-h-[100dvh] overflow-y-auto` + form `items-start` on small viewports |
| Local prod-build smoke blocked by BFF localhost ban under `NODE_ENV=production` | Allow localhost upstream only when HTTP-compat pair is set |

**Audit result:** 57/57 viewport×page checks PASS (0 defects). Web typecheck PASS, web unit tests 51/51 PASS, `next build` PASS, `git diff --check` PASS. Repo-owned CI on PR #45: validate-monorepo, release-validate, docker-build, full-stack-e2e, build — all PASS. (Vercel/Cloudflare Workers preview deploys failed — external credentials; not merge blockers for this closeout.)

---

## Repository-owned gates

| Gate | Result | Evidence |
|------|--------|----------|
| Request→WO regression (PR #43) | PASS | `scripts/verify-phase2-journeys.mjs` P2-reg-* |
| Action Center queues (PR #42) | PASS | P2-action-center-queues; warm aggregate **154ms** |
| WO lifecycle Create→…→Close | PASS | P2-wo-* (QR verify, manager verify/close, cancel, invalid, unauthorized) |
| PM plan create + due evaluation | PASS | P2-pm-*; fix `PmPlanRevision.snapshot` JSON.stringify |
| Inventory stock-in/out/adjust | PASS | P2-inv-*; SQL `quantityInStock` + `StockMovement` |
| Stock count post + duplicate | PASS | P2-sc-*; POSTED; duplicate rejected |
| Procurement list (no live Bileeta) | PASS | P2-procurement-list |
| Fleet + gate eligibility | PASS | P2-fleet-list, P2-gate-eligibility |
| Safety / approvals / reliability | PASS | permits list, approvals inbox, reliability policy |
| SoD (tech cannot approve) | PASS | P2-sod-tech-cannot-approve + SEC-rbac |
| Fresh empty DB migrate+seed×2 | PASS | `verify-phase2-fresh-db.mjs` — 12/27/221 idempotent |
| Upgrade forward migrate | PASS | `verify-phase2-upgrade-db.mjs` — marker qty=7 preserved |
| Backup → restore different DB | PASS | `verify-phase2-backup-restore.mjs` — counts match |
| Security smoke | PASS | `verify-phase2-security.mjs` — 8/8 |
| A11y smoke | PASS | `verify-phase2-a11y.mjs` — login labels; pages 200 |
| PWA repo assets | PASS | `apps/web/public/sw.js` cache v3 + registrar |
| Jest planning + stock-count | PASS | 21 tests |
| Prisma validation ≠ 503 | PASS | HttpExceptionFilter excludes PrismaClientValidationError |

---

## Performance before / after

| Metric | PR #43 baseline | Phase 2 | Notes |
|--------|-----------------|---------|-------|
| GET `/work-orders/queues` | 1611ms | **154ms warm**; cold ~1.2–1.5s after restart | Parallel aggregate wave; indexes already present |
| NAV `/inventory` (dev) | 2704ms | ~2963ms cold document | Next.dev compile; query deferral + staleTime applied |

---

## Code fixes in Phase 2

1. **`planning.service.ts`** — `PmPlanRevision.snapshot` must be `JSON.stringify(...)` (SQL NVarChar), not a Prisma Json object.
2. **`http-exception.filter.ts`** — do not map `PrismaClientValidationError` to `DATABASE_UNAVAILABLE` 503.
3. **`work-order-queues.service.ts`** — Action Center aggregates run in the same parallel wave as queue counts.
4. **`inventory/hooks.ts`** — staleTime + defer analytics until parts ready.

---

## Scripts added

- `scripts/verify-phase2-journeys.mjs`
- `scripts/verify-phase2-fresh-db.mjs`
- `scripts/verify-phase2-upgrade-db.mjs`
- `scripts/verify-phase2-backup-restore.mjs`
- `scripts/verify-phase2-security.mjs`
- `scripts/verify-phase2-a11y.mjs`

---

## External / operator remaining (not repo-owned)

| Item | Classification |
|------|----------------|
| Live Bileeta ERP | EXTERNAL BLOCKER |
| Entra ID production | EXTERNAL BLOCKER |
| SMTP / SMS providers | EXTERNAL BLOCKER |
| Power BI RLS | EXTERNAL BLOCKER |
| Vercel / Cloudflare Workers cutover | OPERATOR ACTION REQUIRED |
| Production DNS / TLS | OPERATOR ACTION REQUIRED |
| Human UAT sign-off | OPERATOR ACTION REQUIRED |
| Responsive visual pass 1920/1366/tablet/mobile | **CLOSED (repo)** — see section above |
| Prod PWA registration on hosted HTTPS | OPERATOR ACTION REQUIRED |
| Full axe WCAG audit in browser | OPERATOR ACTION REQUIRED (SSR landmarks gap noted) |

---

## How to re-run

```bash
# From maintainpro/ with Docker stack up
export ACTION_CENTER_SQL_URL='sqlserver://localhost:14333;database=MaintainProDev;user=sa;password=...;schema=dbo;encrypt=true;trustServerCertificate=true'
export MAINTAINPRO_SEED_PASSWORD='...'

node scripts/verify-phase2-journeys.mjs
node scripts/verify-phase2-backup-restore.mjs
node scripts/verify-phase2-fresh-db.mjs
node scripts/verify-phase2-upgrade-db.mjs
node scripts/verify-phase2-security.mjs
node scripts/verify-phase2-a11y.mjs
node scripts/verify-final-acceptance-perf.mjs

# Responsive visual (production web on :3011)
export RESPONSIVE_QA_BASE_URL='http://localhost:3011'
node scripts/verify-responsive-visual.mjs
node scripts/verify-responsive-wo-detail.mjs
```
