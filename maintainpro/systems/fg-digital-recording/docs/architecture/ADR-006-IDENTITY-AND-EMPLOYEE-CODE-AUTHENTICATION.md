# ADR-006: Identity and Employee-Code Authentication

**Status:** Accepted (Phase 03 foundation)
**Date:** 2026-08-06
**Deciders:** Project Owner (technical foundation)

## Context

Phase 02 delivered a minimal UUID `accounts.User` extending `AbstractUser` with `AUTH_USER_MODEL = "accounts.User"`. Phase 03 must establish named-account authentication for operators without inventing Nelna employee codes or business workflows.

Factory-floor operators are expected to authenticate with an employee code, not an email address or social identity.

## Decision

1. **Login identifier:** Employee code (`User.employee_code`), normalized (strip + uppercase).
2. **Password storage:** Django password hashers only; raw passwords never stored or logged.
3. **Backend:** Custom `EmployeeCodeBackend` (extends `ModelBackend` for permission compatibility) configured ahead of Django’s `ModelBackend`.
4. **Session authentication:** Cookie-based Django sessions; session key rotated on successful login.
5. **Lockout state:** Authoritative on PostgreSQL (`failed_login_count`, `locked_until`); Redis is not the source of truth for lockouts.
6. **Migration:** `employee_code` is nullable for safe migration from Phase 02 users via direct ORM construction only. `UserManager.create_user` / admin creation require a non-empty code. Login rejects accounts without a code. No invented default codes are assigned.
7. **Forced password change:** `must_change_password` plus middleware restricting access to password-change and logout routes.
8. **Generic denials:** Locked, inactive, unknown, and bad-password outcomes share the same login response. Equivalent password-hash work is performed on those paths to reduce enumeration risk (not a hard timing guarantee).
9. **Deferred:** MFA, SSO, LDAP/AD, email/SMS password recovery, public self-registration, API tokens, request-level login rate limiting.

## Consequences

- Admin creates accounts and sets initial passwords; operators change passwords after first login when flagged.
- Username remains on the model for Django compatibility but is not the operator login UI identifier.
- Generic authentication errors avoid account enumeration; lockout does not change the external login response.
- Email/username operator login is out of scope for Phase 03.

## Related

- [ADR-007-SCOPED-RBAC.md](ADR-007-SCOPED-RBAC.md)
- [AUTHENTICATION_AND_ACCESS_CONTROL.md](../security/AUTHENTICATION_AND_ACCESS_CONTROL.md)
