# Form–Endpoint Contract Matrix

**Status:** living inventory (started 2026-07-21). Rows marked **FIXED** have payload fixes in this branch. Real E2E remains **NO-GO** until disposable env tests pass.

## Priority mutations

| Module | UI | Method | Endpoint | Payload builder | Backend DTO / controller | Risks | Status |
|--------|----|--------|----------|-----------------|--------------------------|-------|--------|
| Auth | `app/(auth)/login/page.tsx` | POST | `/auth/login` | inline | `LoginDto` / `auth.controller` | Was localStorage access token; now BFF cookies | FIXED (session) |
| Auth | `register-form-card.tsx` | POST | `/auth/register` | inline | `RegisterDto` | same | FIXED (session) |
| Auth | api-client interceptor | POST | `/auth/refresh` | empty body + cookie | `RefreshTokenDto` | Cross-origin CSRF; now same-origin BFF | FIXED (session) |
| Tenancy | tenancy switch UI | POST | `/tenants/:id/switch` | inline | `tenancy.controller` | Stale localStorage tenant | OPEN (bootstrap) |
| Cleaning issues | `facility-issues-page.tsx` | POST | `/cleaning/issues` | `buildCreateFacilityIssuePayload` | cleaning module DTO | `Number("")` → 0 for slaHours | FIXED |
| Cleaning issues | `qr-issue-report-page.tsx` | POST | `/cleaning/issues` | same | same | blank slaHours → 0 | FIXED |
| Cleaning locations | `cleaning/locations/page.tsx` | POST | `/cleaning/locations` | inline | cleaning locations | blank frequency/radius → 0 | FIXED |
| Vehicles | `vehicles/page.tsx` | POST/PATCH | `/vehicles` | inline | vehicles DTOs | enum/duplicate/cross-tenant | OPEN (E2E) |
| Assets | assets pages | POST/PATCH | `/assets` | various | assets DTOs | bulk/export | OPEN (E2E) |
| Work orders | work-order pages | POST/PATCH | `/work-orders*` | various | work-order DTOs | status transitions | OPEN (E2E) |
| Employees | `employees/page.tsx` | POST/PUT | `/workforce/employees` | inline | workforce DTOs | optional login email | OPEN (E2E) |
| Inventory | inventory pages | POST/PATCH | `/inventory*` | various | inventory DTOs | adjustments/approvals | OPEN (E2E) |

## Contract rules going forward

1. Prefer `lib/form-payload.ts` helpers for numbers/ids/dates.
2. Generate OpenAPI types (tracked) — do not hand-duplicate DTOs long term.
3. Every critical row needs a real E2E create+update+reload proof before GO.

## Known blank-number pattern

`Number(formData.get("field") ?? default)` is unsafe when `get` returns `""` because `??` does not replace empty string. Use `toOptionalNumber(...) ?? default` instead.