# Playwright QA suite (local seeded stack)

## Purpose

Production-oriented browser + API verification against a running MaintainPro stack
(`http://127.0.0.1:3001` + API `:3000`) using seeded personas.

Config: `apps/web/playwright.qa.config.ts`
Specs: `apps/web/e2e/<domain>/**/*.spec.ts`
Auth state: `apps/web/playwright/.auth/*.json` (gitignored)

Legacy mocked UI specs remain in `apps/web/e2e/*.spec.ts` with `playwright.config.ts`.
Docker full-stack suite remains in `e2e-real/` + `playwright.full-stack.config.ts`.

## Setup

```bash
cd maintainpro
cp .env.e2e.example .env.e2e
# Set E2E_PASSWORD / role emails (same password as MAINTAINPRO_SEED_PASSWORD)
npm run dev
cd apps/web
npx playwright install chromium
npm run test:e2e:qa
npm run test:e2e:report
```

## Known application defects / blockers exposed

| ID | Symptom | Notes |
| --- | --- | --- |
| QA-E2E-AUTH-REDIRECT | Unauthenticated (or post-logout) `GET /action-center` stays on `/action-center` instead of `/login` | Keep failing tests in auth session specs |
| QA-E2E-MI-COST | `GET /api/reports/management/downtime-cost` can 500 (`toFixed is not a function`) | Annotated in reports suite |
| QA-E2E-AUTH-THROTTLE | Rapid multi-persona login hits HTTP 429 | Setup uses backoff; cool down between full suite runs |
| QA-E2E-XSS-REQUEST | Maintenance request description can store raw `<script>` markup | Keep failing HTML sanitization assertion |
| QA-E2E-EMPLOYEE-ASSIGN | WO assign can 409 on `dbo.Employee` uniqueness when linking technician | Data/model conflict during assignee sync |
| QA-E2E-LABOUR-SESSION | Technician `start` blocked while another IN_PROGRESS labour session exists | Expected governance; suite clears sessions when possible |
| QA-E2E-FLEET-ODO | Negative `odometerReading` on vehicle WO create returns 201 | Keep failing until API rejects `< 0` |

Stabilization report: `docs/PLAYWRIGHT_QA_STABILIZATION_REPORT.md`.

Auth env knobs: `E2E_FORCE_AUTH`, `E2E_AUTH_LOGIN_GAP_MS` (default 8000), `E2E_AUTH_MAX_REUSE_MS` (default 240000).

## Commands

| Script | Purpose |
| --- | --- |
| `npm run test:e2e:qa` | Full local QA suite |
| `npm run test:e2e:maintenance` | Requests / WO / cross-module |
| `npm run test:e2e:rbac` | RBAC matrix |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:e2e:headed` | Headed Chromium |
| `npm run test:e2e:report` | Open HTML report |
