# Phase 1 — Product Scope Cleanup & Navigation Refactor

**Date:** 2026-09-14  
**Branch:** `maintainpro/phase-01-scope-cleanup`  
**Base:** Phase 0 tip `f78d465` (on top of `origin/main` @ `290bf3a`)  
**Scope:** Product boundary, navigation, Admin landing cleanup. **No broad DB drops.** **No Phase 2 engines.**

---

## Product boundary (enforced in UI)

**In scope (CMMS / Fleet):** Maintenance requests, work orders, preventive maintenance, assets (incl. facilities/utilities as maintainable infrastructure), fleet, spare-parts usage (Bileeta), reports, business Admin, technical Admin.

**Retired from normal product surface:** Farm Operations, Cleaning workforce, embedded FG product UI, SaaS Billing UX, Predictive AI nav, QA/Delivery/Go-Live/Post-Go-Live Admin clutter.

**Retained intentionally:**
- Backend modules/APIs for retired domains (Phase 14 cleanup later)
- FG SSO bridge (`/fg/sso`, `fg.access` path access)
- Farm **infrastructure** maintainability via Assets (not farm ops UX)
- Prisma models for retired domains (no destructive drops)
- RoleDashboard / Action Center widget code for later Home KPI embedding

---

## Navigation

### Primary (final)

| Nav | Href |
|-----|------|
| Home | `/action-center` |
| Requests | `/qr/report-issue` |
| Work Orders | `/work-orders` |
| Preventive Maintenance | `/maintenance/forecast` |
| Assets | `/assets` |
| Fleet | `/fleet` |
| Spare Parts | `/inventory` |
| Reports | `/reports` |
| Admin | `/admin` |

### Secondary

Notifications, My Profile, Technical Admin (`/system-health`), ERP & Spare Parts Sync (`/erp`).

### Old → New

| Old | New |
|-----|-----|
| Workspace | → Home (`/action-center`); `/workspace` redirects |
| Dashboard | → Home; `/dashboard` redirects |
| Action Center (top-level) | Relabeled **Home** (same route) |
| My Tasks / Waiting Parts / queues | Under Home widgets (not top-level) |
| Facilities (top-level) | Assets (+ path aliases) |
| Cleaning / Farm / Billing / Predictive AI | Hidden; path access admin-only |
| FG Digital Records nav | Removed; SSO path retained |
| Admin QA / Delivery / Go-Live cards | Removed from business Admin |

---

## Admin cleanup

Business Admin landing cards aligned to: Overview, Organization, Assets & Master Data, People & Access, Maintenance Setup, Fleet Setup, Vendors & Contracts, ERP & Spare Parts, Data Quality, Notifications, Audit, plus Technical Administration → `/system-health`.

SaaS Tenants / Delivery / Go-Live / Post-Go-Live / QA clutter removed from this landing.

---

## Database

- **Schema changes:** none
- **Models dropped:** none
- Deprecated domain models retained until Phase 14 (see Phase 0 `DATA_MODEL_DISPOSITION.md`)

---

## Compatibility / auth notes

- Frontend nav hide ≠ API auth removal — backend guards unchanged
- Retired path prefixes soft-blocked for non-admin in `canAccessNavigationPath`
- Compatibility redirects: `/workspace`, `/dashboard` → `/action-center`

---

## Follow-up (not Phase 1)

- Full role dashboard redesign (Phase 13 style)
- Full Admin Phase 12 rebuild
- Destructive model retirement (Phase 14)
- Request/WO/PM engine rebuilds (later phases)
- Terminology cleanup beyond primary nav labels
