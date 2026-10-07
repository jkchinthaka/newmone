# Playwright QA suite — stabilization report

**Branch:** `test/playwright-qa-suite`
**Date:** 2026-10-07
**Scope:** Stabilize existing suite (Phases 1–7). No broad new coverage. No merge/PR. No security weakening.

---

## Latest evidence (`npm run test:e2e:qa`) — incomplete full suite

**This is the most recent full-suite attempt. It is not a green run. Do not treat it as suite completion.**

| Metric | Result |
| --- | --- |
| Command | `npm run test:e2e:qa` |
| Tests discovered | 90 |
| Passed | 6 |
| Failed | 2 |
| Did not run | 82 (setup / early auth failures blocked downstream projects) |
| Suite complete? | **No** |

### Failures and classification

| Observation | Class | Notes |
| --- | --- | --- |
| Setup `authenticate manager` → HTTP **502** (during this full run) | **D** (transient env/auth flake) | Isolated rerun of `authenticate manager` passed **1/1**. Not a confirmed product defect. |
| `session.unauth` — direct protected route redirects when logged out | **A** (product) | Failed in the full run **and** in an isolated rerun. Keep assertion. |
| Remaining 82 tests | n/a | Never started because setup/early failures stopped the run. |

### QA-E2E-AUTH-REDIRECT — confirmed product defect (latest evidence)

- Logged-out navigation to `/action-center` **stayed on** `/action-center` (did **not** redirect to `/login`).
- Playwright error context showed UI copy: **"Tenant access required"** / **"Unauthorized"**.
- `GET /api/backend/auth/me` → **401** `AUTHENTICATION_REQUIRED` (API correctly rejects unauthenticated access).
- `POST /api/backend/auth/refresh` without session/CSRF → **403** `CSRF_INVALID` (expected for anonymous refresh).
- Gap is client/BFF route protection: protected shell remains reachable while session APIs deny access.
- **Do not weaken** the Playwright `/login` redirect assertion.
- Requires a **separate production-code fix** (out of scope for suite-only stabilization).

XSS request storage and negative fleet odometer were **not re-proven** in this incomplete run (those specs did not execute). They remain historically classified as class-A from earlier completed runs.

---

## Historical — Phase 6 controlled suite results (earlier same day)

These runs completed before the latest incomplete `npm run test:e2e:qa` attempt. They remain valid historical evidence for those controlled scopes only; they do **not** override the latest incomplete 90-test attempt.

| Suite | Total | Passed | Failed | Skipped | Flaky/retried | Duration |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1. Auth (setup + auth + login smoke) | 13 | 11 | 2 | 0 | 0 | 1.7m |
| 2. Requests | 10 | 9 | 1 | 0 | 0 | 55.9s |
| 3. Maintenance lifecycle (`work-orders` + `maintenance`) | 22 | 22 | 0 | 0 | 0 | 1.2m |
| 4. RBAC | 24 | 24 | 0 | 0 | 0 | 1.1m |
| 5. Critical cross-module path | 7 | 7 | 0 | 0 | 0 | 32.9s |
| 6. Full QA suite (post-auth orchestration fix) | 90 | 85 | 5 | 0 | 0 | 10.6m |

Additional historical notes (same stabilization day):

- Early full suite cascaded to **63/27** due to shared `storageState` poisoning (refresh-token rotation + logout revoking admin session). Suite orchestration fixed afterward.
- Intermediate full run after auth fix: **84/6** (included planning/PM test defects, since fixed in the suite).
- After the **85/5** full run, `asset-status` was fixed (tech start + labour cleanup) and verified **7/7** in isolation → **projected** full suite **86/4**, but that projection was **never proven** by a fresh completed 90-test run.
- Local `retries: 0` (CI config allows 1).

---

## Phase 7 — Stabilization summary

### 1. Files changed (suite / docs)

| Area | Paths |
| --- | --- |
| Auth orchestration | `e2e/auth.setup.ts` (reuse + max age 4m + login gap) |
| Session helpers | `e2e/helpers/session.ts`, `e2e/helpers/auth.ts`, `e2e/helpers/work-orders.ts`, `e2e/helpers/requests.ts` |
| Role context persistence | `e2e/helpers/role-context.ts`, `e2e/fixtures/qa.ts` |
| Specs | `e2e/auth/*`, `e2e/cross-module/*`, `e2e/maintenance/*`, `e2e/requests/*`, `e2e/rbac/*`, `e2e/assets/*`, `e2e/planning/*`, `e2e/pm/*`, plus domain specs importing fixtures |
| Config / docs | `playwright.qa.config.ts`, `docs/PLAYWRIGHT_QA_FAILURE_CLASSIFICATION.md`, `docs/PLAYWRIGHT_QA_SUITE.md`, this report |

Credentials remain in `.env.e2e` only (not committed).

### 2. Test infrastructure changes

- **storageState reuse** with `/auth/me` validation and **max reuse age** (`E2E_AUTH_MAX_REUSE_MS`, default 4 minutes) so a full suite stays within access-token TTL without mid-run refresh races.
- **Serial persona login gap** (`E2E_AUTH_LOGIN_GAP_MS`, default 8s); `E2E_FORCE_AUTH=1` forces fresh logins.
- **Persist rotated cookies** after each authenticated test (`fixtures/qa`) and on `openRoleContext().close()` so refresh-token rotation cannot poison the next test.
- **Logout test isolation:** fresh login in empty context — does not revoke shared admin storageState.
- **Work-order helpers:** convert envelope `workOrder` / `workOrderId`; QR verify before complete; clearer labour-session cleanup.
- Unique `qaTag()` identifiers for mutable records; no mass delete of master data.

### 3. Application defects (product)

| ID | Class | Exact reason | Latest status |
| --- | --- | --- | --- |
| QA-E2E-AUTH-REDIRECT | **A** | Logged-out `GET /action-center` remains on `/action-center` (no redirect to `/login`) while `/auth/me` is 401 | **Reconfirmed** in latest incomplete full run + isolated rerun |
| QA-E2E-XSS-REQUEST | **A** | Maintenance request `description` persists raw `<script>alert(...)` | Historical (not re-run in latest incomplete suite) |
| QA-E2E-FLEET-ODO | **A** | `POST /work-orders` with `odometerReading: -1` returns **201** | Historical (not re-run in latest incomplete suite) |

Also historically noted: QA-E2E-MI-COST (reports allow 500), QA-E2E-EMPLOYEE-ASSIGN (assign path green in historical lifecycle/critical).

### 4. Test defects fixed (suite)

| Issue | Class | Fix |
| --- | --- | --- |
| Convert empty `woId` | **B** | Parse nested `workOrder` / `workOrderId` |
| Tech complete 400 (QR) | **B** | Call `verify-qr` before complete |
| Start 409 labour session | **C** | `clearTechnicianActiveSessions` + tech-context start |
| Full-suite 401 cascade | **B/D** | Persist storageState; isolate logout; max reuse age |
| Planning reschedule 400 | **B** | Patch start+end+due together |
| PM create 500 | **B** | Trigger field is `kind`, not `type` |
| Asset-status start 409 | **B/C** | Start as tech after clearing sessions |

### 5. Environment / state problems

- Login **429** mitigated by reuse + cooldown (throttle left intact).
- Refresh-token **reuse detection** cascade fixed via cookie persistence.
- API **EADDRINUSE** / hung Next / occasional **502** during persona setup (e.g. manager in latest run) — local infra risk; restart `:3000`/`:3001` if health fails.
- Seeded open WOs / labour sessions handled with cleanup helpers; leftover `QA-E2E-*` OPEN WOs may accumulate (safe to leave; do not bulk-delete master data).

**Cannot auto-clean safely:** seed assets/vehicles/parts/users; non-QA historical WOs; production-like inventory stock levels.

### 6. Current known failing / blocked tests

**From latest incomplete run (executed):**

| Test | Reason |
| --- | --- |
| `session.unauth` — direct protected route redirects when logged out | QA-E2E-AUTH-REDIRECT (**A**) — reconfirmed |
| Setup `authenticate manager` (this run only) | **502** — class **D** flake; isolated rerun passed |

**From historical completed runs (not executed in latest incomplete suite):**

| Test | Reason |
| --- | --- |
| `session.auth` — logout clears session and blocks protected route | QA-E2E-AUTH-REDIRECT (**A**) — second test case, same root defect |
| `request-create` — HTML-like description sanitized/rejected | QA-E2E-XSS-REQUEST (**A**) |
| `fleet/vehicle-wo` — odometer validation | QA-E2E-FLEET-ODO (**A**) |

No skips used to inflate pass rate. Playwright AUTH-REDIRECT assertion must not be weakened.

### 7. Critical-path verdict

**Historical controlled run: PASS (7/7).**
That result does **not** mean the latest 90-test `npm run test:e2e:qa` completed or that critical-path was re-run successfully afterward (82 tests did not run).

### 8. RBAC verdict

**Historical controlled run: PASS (24/24); historical completed full suite also green for RBAC matrix.**
That does **not** imply RBAC was exercised in the latest incomplete 90-test attempt.

### 9. Safe for repeated local execution?

**Partially**, with caveats:

- Prefer `workers: 1`, cool down ~30–60s between full runs if forcing auth.
- Keep `E2E_FORCE_AUTH` unset for rapid re-runs (reuse within 4 minutes).
- Ensure API/web stay healthy (`EADDRINUSE`, hung Next, intermittent **502** on login/setup seen under load).
- Expect AUTH-REDIRECT (and historically XSS + fleet odo) until product fixes land.
- Latest full suite did **not** complete; do not assume 86/90 or 90/90 without a fresh completed run.

### 10. Ready to become a CI PR gate?

**No** — not as a hard fail-all gate, and not while the latest full suite is incomplete.

Blockers:

- QA-E2E-AUTH-REDIRECT (confirmed product defect; needs production-code fix)
- Historically confirmed XSS request storage and negative fleet odometer (need re-proof after AUTH-REDIRECT fix + healthy stack)
- Stack boot / transient 502 reliability for persona setup

Do **not** allowlist AUTH-REDIRECT merely to green CI. Do **not** weaken the Playwright assertion.

---

## Phase 1 classification (original critical 6) — closed for suite B/C/D work

See `docs/PLAYWRIGHT_QA_FAILURE_CLASSIFICATION.md`. Stabilization addressed B/C/D items; class-A product items remain.

---

**Next instruction wait:** production-code fix for QA-E2E-AUTH-REDIRECT (then XSS / fleet odo), followed by a clean completed `npm run test:e2e:qa`. No merge, no PR.
