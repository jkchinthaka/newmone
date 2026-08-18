# Security Baseline

**Document status:** Living baseline — Phase 03 auth/RBAC foundation under implementation  
**Phase:** 03 — Accounts / authentication / scoped RBAC  
**Last updated:** 2026-08-06

## Principles

- Deny access by default
- Individual accountability
- Server-side authorization
- Auditable important operations
- No secrets in source control
- No production access or deployment without explicit approval

## Individual named accounts

Every interactive user has a unique named account. Shared accounts are prohibited. Phase 03 login identifier is **employee code** (ADR-006).

## Password hashing

Passwords are stored only using Django’s password hashers (or an approved equivalent). Plaintext passwords must never be logged or stored.

## Session authentication

The browser uses Django session authentication (ADR-006). Session key rotates on successful login. Exact idle/absolute timeouts remain **EVIDENCE REQUIRED** for final IT policy.

## Deny-by-default authorization

Policies deny unless a positive grant matches (ADR-007). UI hiding is never sufficient authorization. See [AUTHENTICATION_AND_ACCESS_CONTROL.md](AUTHENTICATION_AND_ACCESS_CONTROL.md).

## Scoped roles

Roles use Django permissions with optional organization/site/department scope via `ScopedRoleAssignment`. No business roles are seeded in Phase 03.

## Separation of duties

Conflicting actions (for example submit vs check vs verify, as defined by QA) are enforced in policies with automated tests.

## Secure cookies

Production cookies use Secure and appropriate SameSite settings. Session and CSRF cookies are HttpOnly. CSRF tokens for forms and HTMX are supplied via Django templates (not `document.cookie`).

## CSRF

CSRF protection remains enabled for authenticated browser workflows.

## Rate limiting

Authentication and other abuse-sensitive endpoints must be rate limited when implemented.

## Secret management

Secrets come from environment variables or a secret manager. Never commit `.env` production secrets, keys, or connection strings.

## Audit events

Important auth/RBAC operations append `SecurityAuditEvent` rows (see [SECURITY_EVENT_CATALOGUE.md](SECURITY_EVENT_CATALOGUE.md)). Audit history is preserved; retention period deferred.

## Evidence access

Evidence metadata access follows the same authorization model as related records. Retrieval should prefer short-lived signed URLs from object storage.

## Object-storage signed URLs

Prefer time-limited signed URLs over long-lived public objects for evidence.

## Dependency scanning

When application dependencies exist, enable dependency vulnerability scanning in CI.

## Security headers

Production deployments should set standard security headers (for example via Django settings and/or Nginx) appropriate to the threat model.

## Privileged-access review

Admin and elevated roles require periodic review (**cadence DECISION REQUIRED**).

## Incident response

Suspected incidents trigger session revocation, access review, evidence preservation, and owner notification per an IT-approved incident process (**EVIDENCE REQUIRED** for final playbook).

## Production-access restrictions

Production shell/database access is restricted, logged where feasible, and not used for routine support without approval.

## Explicit non-claims

This baseline does not assert that the system is currently secure, certified, or production-ready. Controls must be implemented and tested in later phases.
