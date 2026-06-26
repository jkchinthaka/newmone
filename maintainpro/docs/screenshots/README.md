# MaintainPro portfolio screenshots (staging)

Captured during **UAT-002** and **UAT-003** from hosted staging:

- **Web:** https://newmone.chinthakajayaweera1.workers.dev
- **API:** https://newmone.onrender.com/api

Use seed demo accounts from `README.md` (password via secret manager only).

## Capture checklist (UAT-003 numbering)

| # | File | Screen | Status |
|---|------|--------|--------|
| 01 | `staging/01-login.png` | Login page | Auto — `npm run test:e2e:staging:uat003` |
| 02 | `staging/02-admin-dashboard.png` | Admin dashboard KPIs | Auto |
| 03 | `staging/03-admin-console.png` | Admin Console | Auto |
| 04 | `staging/04-manager-dashboard.png` | Manager dashboard | Auto |
| 05 | `staging/05-work-order-list.png` | Work order kanban/list | Auto (warm load) |
| 06 | `staging/06-work-order-detail.png` | Work order editor modal | Auto — opens Edit on first card |
| 07 | `staging/07-technician-jobs.png` | Technician work orders | Auto |
| 08 | `staging/08-security-fleet-gate.png` | Security officer fleet | Auto |
| 09 | `staging/09-inventory-stock.png` | Inventory / low stock | Auto |
| 10 | `staging/10-erp-system-health.png` | System health / ERP panel | Auto |
| 11 | `staging/11-reports-dashboard.png` | Reports hub | Auto |
| 12 | `staging/12-audit-trail.png` | Settings → Audit tab | **OPERATOR-OWNED** if tab not visible on staging |
| 13 | `staging/13-mobile-technician.png` | Flutter mobile | **NOT AVAILABLE** in web repo |

### Legacy filenames (UAT-002)

Older captures may exist as `06-technician-work-orders.png`, `07-security-fleet.png`, `08-inventory-stock.png`, `12-audit-trail-settings.png`. Prefer UAT-003 numbered files for portfolio.

## Regenerate (no secrets in repo)

```bash
cd maintainpro
# Requires .env.render.local with RENDER_API_KEY or shell MAINTAINPRO_SMOKE_PASSWORD
npm run test:e2e:staging:uat003
npm run uat:003:validate   # full lifecycle + regression
```

Screenshots are written by Playwright to `docs/screenshots/staging/` during warm-session tests. Commit PNGs only after review (no credentials visible in UI).

## Placeholder policy

If a PNG is missing, the portfolio case study links to this checklist rather than implying the feature is unimplemented.
