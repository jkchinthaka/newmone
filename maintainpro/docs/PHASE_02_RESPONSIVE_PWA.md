# Phase 2 — Responsive Web + PWA Foundation

**Date:** 2026-09-14  
**Branch:** `maintainpro/phase-02-responsive-pwa`  
**Phase 1 baseline:** `maintainpro/phase-01-scope-cleanup` @ `d954360`  
**Scope:** Responsive shell, PWA/network/offline foundations, web QR + evidence UX.  
**Out of scope:** Organization/Asset/Request/WO/Approval engines (Phases 3–7). No Phase 8–14 code.

---

## Architecture

### Desktop / large (`xl+`)
- Sidebar + topbar + content
- Phase 1 CMMS primary navigation unchanged

### Tablet / phone (`< xl`)
- Drawer nav + compact topbar + bottom quick nav
- Bottom nav: Home + role-relevant Requests/Work Orders/Assets + Search + Profile
- Operational tables keep desktop density; cards on narrow screens (`md` split)

### Shared primitives
- `ResponsivePageHeader`
- `MobileRecordCard` / `ResponsiveDataList`
- `NetworkStatusBanner`
- `QrScanner` (lazy `html5-qrcode`, camera released on close)
- `EvidencePicker` (preview / remove / camera capture hint)

---

## PWA

| Item | Implementation |
|------|----------------|
| Manifest | `app/manifest.ts` + `lib/pwa-metadata.ts` |
| Icons | Existing SVG assets under `public/` |
| Start URL | `/splash` |
| Display | `standalone` |
| Service worker | `public/sw.js` (v3) |

### Caching rules
- **Cache:** app shell static assets, icons, immutable `/_next/static` chunks
- **Do not cache:** `/api/*`, authenticated HTML navigations, tokens, WO/API payloads
- Navigations are **network-first** with `/offline.html` fallback only

---

## Network / offline / idempotency

- `lib/network-status.ts` + banner toast on reconnect
- `lib/offline-queue.ts` — PENDING/SYNCING/SYNCED/FAILED foundation (metadata only; no secrets)
- `lib/idempotency.ts` — key + header helpers for later mutation safety
- Existing WO evidence offline drafts retained (`work-order-evidence-offline.ts`)

Offline does **not** claim server sync until API confirmation succeeds.

---

## QR & evidence

- Permissions-Policy: `camera=(self)` (was blocked at `camera=()`)
- Shared scanner used for WO QR verification (manual fallback always available)
- Evidence picker wired into WO evidence panel; server upload validation unchanged

---

## Flutter

Marked **non-production / deprecated** in `apps/mobile/README.md`. Source retained for knowledge until web parity is complete. Not deleted.

---

## Security

- Backend RBAC unchanged
- No passwords/tokens in offline queue
- SW does not intercept `/api/`
- Upload MIME/size still enforced server-side

---

## Limitations

- Full offline CMMS not attempted
- QR camera requires HTTPS (or localhost) and user permission
- Admin/Reports remain desktop-oriented; made safe, not redesigned
- Manual device lab testing may be incomplete in CI environments

---

## Phase 3 dependencies

Phase 3 must start from the final Phase 2 tip on `maintainpro/phase-02-responsive-pwa`. Organization / Functional Location work builds on this responsive shell — not on Phase 8–14.
