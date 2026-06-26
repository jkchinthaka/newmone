# MaintainPro portfolio screenshots (staging)

Captured during **UAT-002** from hosted staging:

- **Web:** https://newmone.chinthakajayaweera1.workers.dev
- **API:** https://newmone.onrender.com/api

Use seed demo accounts from `README.md` (password via secret manager only).

## Capture checklist

| # | File | Screen | Status |
|---|------|--------|--------|
| 01 | `staging/01-login.png` | Login page | Auto-capture via `npm run test:e2e:staging:uat002` |
| 02 | `staging/02-admin-dashboard.png` | Admin dashboard KPIs | Auto-capture |
| 03 | `staging/03-admin-console.png` | Admin Console | Auto-capture |
| 04 | `staging/04-manager-dashboard.png` | Manager dashboard | Auto-capture |
| 05 | `staging/05-work-order-list.png` | Work order list | Auto-capture |
| 06 | `staging/06-technician-work-orders.png` | Technician work orders | Auto-capture |
| 07 | `staging/07-security-fleet.png` | Security officer fleet | Auto-capture |
| 07b | `staging/07b-security-vehicles.png` | Vehicle register | Auto-capture |
| 08 | `staging/08-inventory-stock.png` | Inventory / low stock | Auto-capture |
| 09 | `staging/09-work-order-detail.png` | Work order detail modal | **OPERATOR-OWNED** — open WO editor manually |
| 10 | `staging/10-erp-system-health.png` | System health / ERP panel | Auto-capture |
| 11 | `staging/11-reports-dashboard.png` | Reports hub | Auto-capture |
| 11 | `staging/11-reports-dashboard.png` | Reports hub | Auto-capture |
| 12 | `staging/12-audit-trail-settings.png` | Settings → Audit tab | Auto-capture when tab visible |
| 13 | `staging/13-mobile-technician.png` | Flutter mobile | **NOT AVAILABLE** in web repo — capture from `apps/mobile` |

## Regenerate (no secrets in repo)

```bash
cd maintainpro
# Requires .env.render.local with RENDER_API_KEY or shell MAINTAINPRO_SMOKE_PASSWORD
npm run test:e2e:staging:uat002
```

Screenshots are written by Playwright to this folder during UAT-002 browser tests. Commit PNGs only after review (no credentials visible in UI).

## Placeholder policy

If a PNG is missing, the portfolio case study links to this checklist rather than implying the feature is unimplemented.
