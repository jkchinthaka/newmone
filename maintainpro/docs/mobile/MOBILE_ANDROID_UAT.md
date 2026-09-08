# Mobile V2 Android Visual UAT (2026-09-01)

## Environment

| Item | Value |
|------|-------|
| Branch | `feature/mobile-v2` |
| Emulator | `sdk gphone64 x86 64` (API 36, emulator-5554) |
| API health | `http://localhost:3000/health` → 200 |
| App package | `com.maintainpro.mobile` |
| API target (emulator) | `http://10.0.2.2:3000` |

## Emulator visual pass

### Verified on device

- **Login screen** — premium branding, clear hierarchy, password visibility toggle, keyboard-safe layout (screenshot reviewed).
- **App launch** — debug APK installs and opens without crash.
- **Safe area / status bar** — correct on phone emulator.

### Blocked (credentials)

Local `MAINTAINPRO_SEED_PASSWORD` in `.env` does **not** match the password hash on the running API database (`superadmin@maintainpro.local` → 401). `npm run db:seed` cannot re-align from this workstation (Atlas/network constraints when seed runs). **Post-login SUPER_ADMIN walkthrough requires password re-sync or seed from an allowed host.**

### Widget / layout verification (automated)

- **127 + 3** widget tests pass including large-text (1.3×) layout smoke for Home, Admin hub, Reports hub.
- Existing screen tests cover Gate, Fleet, Assets, Inventory, Facilities, Compliance, Alerts, FG, Sync, Work Orders.

## Role spot checks (automated RBAC)

| Role | Method | Result |
|------|--------|--------|
| SUPER_ADMIN | Nav policy + screen tests | PASS |
| ADMIN | Admin/reports screen tests | PASS |
| MANAGER | Admin blocked test | PASS |
| TECHNICIAN | WO nav matrix | PASS |
| SECURITY_OFFICER | Gate nav + screen test | PASS |
| DRIVER | Inventory hidden | PASS |
| INVENTORY_KEEPER | Inventory nav | PASS |
| SUPERVISOR/CLEANER | Facilities FAB test | PASS |

## CI (PR #28 @ 35ec758+)

| Check | Status |
|-------|--------|
| validate-monorepo (PR Validation) | PASS |
| build (Docker Image CI) | PASS |
| docker-build | FAIL (compose fixture — baseline) |
| release-validate | FAIL (baseline) |
| full-stack-e2e | FAIL (baseline) |
| Vercel / Netlify preview | PASS |

No new mobile regressions introduced by this slice.

## Defects fixed this pass

- Fleet vehicles list: generic catch no longer surfaces raw `e.toString()` to users.
- Reports dashboard: analyzer info lint (string interpolation).

## Remaining manual step

1. Align seed password with API DB (or run seed from Atlas-allowed host).
2. SUPER_ADMIN emulator walkthrough: Home → Tasks → WO → Fleet → FG → Admin → Reports → Farm → Sync.
3. Optional tablet emulator for NavigationRail (responsive tests cover KPI grid).

## Status

`FINAL_VISUAL_CLOSURE=PARTIAL` — login UI verified on emulator; full authenticated walkthrough blocked on seed/password drift until credentials aligned.
