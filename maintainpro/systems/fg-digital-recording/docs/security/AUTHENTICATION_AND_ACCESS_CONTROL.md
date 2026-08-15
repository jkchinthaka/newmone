# Authentication and Access Control

**Document status:** Phase 03–07B foundation guidance (+ Phase 03C operational role governance)
**Last updated:** 2026-08-10

## Login lifecycle

1. Operator submits employee code + password (CSRF-protected).
2. Code is normalized; backend authenticates via Django password verification.
3. All denial outcomes (unknown code, wrong password, inactive, locked, missing code) return the same HTTP status, login template, and generic message — never a locked-account redirect based on the submitted code.
4. Success: failed counters reset, session key rotated, audit `LOGIN_SUCCESS`, redirect to landing or forced password change.

Password-hash work runs on unknown, inactive, and locked paths to reduce timing-based enumeration risk. This is a mitigation, not a hard timing-equality guarantee.

## Lockout

| Setting | Default | Meaning |
| --- | --- | --- |
| `AUTH_MAX_FAILED_ATTEMPTS` | 5 | Failures before temporary lock |
| `AUTH_LOCKOUT_MINUTES` | 15 | Lock duration |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW` | 300 | IP login throttle window (seconds) — Phase 19 |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | 40 | Max login attempts per IP per window — Phase 19 |

PostgreSQL account lockout (`failed_login_count`, `locked_until`) is the active brute-force control. Updates use transactions and `select_for_update`. Redis is not authoritative for lockout. Already-locked attempts do not extend counters.

The dedicated `/accounts/locked/` page is not selected from a login attempt based on employee-code existence.

## Password change

- Authenticated change requires current password and Django validators.
- Clears `must_change_password`, sets `password_changed_at`, audits `PASSWORD_CHANGED`.
- Forced-change middleware restricts users flagged `must_change_password` to password-change and logout routes only.
- Session is rotated (or safely renewed) after password change while remaining authenticated.

## Admin account management

- Create users with **required** employee code; set initial password safely; mark forced change.
- `UserManager.create_user` / `create_superuser` reject missing employee codes. Nullable codes remain only for migration-compatible direct ORM construction.
- Unlock via explicit admin action; view lockout and login timestamps.
- Assign scoped roles through controlled admin forms.
- Never display or log raw passwords.

## Session security

- HttpOnly session cookie; Secure + HTTPS redirect in production.
- Session rotation on login (explicitly tested); logout is POST + CSRF and flushes the session.

## Permission checks

Server-side enforcement via `access_control` services, decorators, and mixins. Fail closed. Cross-scope denial is mandatory.

Active `ScopedRoleAssignment` uniqueness uses PostgreSQL `NULLS NOT DISTINCT` semantics. Service-layer duplicate checks provide friendly validation; the database constraint is authoritative under concurrency.

Checklist task capabilities (Phase 07A/07B):

| Permission | Purpose |
| --- | --- |
| `scheduling.view_checklisttask` | View orchestration tasks |
| `scheduling.manage_checklisttask` | Administrative create/cancel |
| `scheduling.record_checklisttask` | Phase 08A draft recording — catalogue permission; not auto-assigned to business roles |

Manage does **not** imply record. Record does **not** imply Supervisor review. Supervisor review does **not** imply QA review. Django superuser is **not** business QA authority.

Phase **03C** adds a frozen operational permission catalogue, technical `RoleTemplate` bundles (optional `business_category_hint` only — not approval), and audited services to set role permissions / apply templates onto Roles **without** auto-assigning employees. Business mapping remains **APPROVAL REQUIRED** — see [OPERATIONAL_PERMISSION_MATRIX.md](OPERATIONAL_PERMISSION_MATRIX.md) and [PHASE_03C_OPERATIONAL_ROLE_GOVERNANCE.md](../business/PHASE_03C_OPERATIONAL_ROLE_GOVERNANCE.md).

## Security audit

See [SECURITY_EVENT_CATALOGUE.md](SECURITY_EVENT_CATALOGUE.md). Prohibited: passwords, session IDs, cookies, Authorization headers, CSRF tokens, raw bodies, full DB/Redis URLs. Internal audit metadata may record non-sensitive denial reasons (`invalid_credentials`, `account_locked`, `inactive`) that are never shown in the login response.

## Related

- ADR-006, ADR-007, ADR-011, ADR-012
- [CHECKLIST_RECORDER_ROLE_MAPPING.md](../business/CHECKLIST_RECORDER_ROLE_MAPPING.md)
- [OPERATIONAL_PERMISSION_MATRIX.md](OPERATIONAL_PERMISSION_MATRIX.md)
- [PHASE_03C_OPERATIONAL_ROLE_GOVERNANCE.md](../business/PHASE_03C_OPERATIONAL_ROLE_GOVERNANCE.md)
- [PHASE_03_TEST_PLAN.md](../testing/PHASE_03_TEST_PLAN.md)
- [PHASE_03C_TEST_PLAN.md](../testing/PHASE_03C_TEST_PLAN.md)
