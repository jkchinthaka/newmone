# Final Security Review (Technical)

**Classification:** TECHNICAL SECURITY REVIEW — not company security sign-off.
**Date prepared:** 2026-08-12
**Application baseline under UAT:** `c08ebec96b8551209bc2228866ceb2fb65031668`
**Do not fabricate formal company security sign-off.**

## Scope

RBAC, IDOR, cross-org isolation, CSRF, session security, staff/admin bypass, open redirects, uploads, path traversal, subprocess, CSV injection, unsafe HTML, secret leakage, SSRF, rate abuse, object ownership, export/print authorization, audit immutability.

## Findings summary

| ID | Area | Severity | Status | Notes |
| --- | --- | --- | --- | --- |
| SEC-01 | Production `DEBUG=False`, secure cookies, HSTS, SSL redirect | — | Mitigated in `config.settings.production` | Requires correct env on deploy |
| SEC-02 | Non-wildcard `ALLOWED_HOSTS` + CSRF trusted origins | — | Enforced fail-closed in production settings | EXTERNAL: real hosts/TLS |
| SEC-03 | Organization-scoped RBAC | HIGH if broken | Covered by tests/policies; human UAT-01 PASS recorded | Continue IDOR testing in remaining UAT |
| SEC-04 | Cross-org isolation | HIGH if broken | UAT-18 awaiting human; technical tests exist | AWAITING HUMAN UAT |
| SEC-05 | CSRF on state-changing views | MEDIUM | Django CSRF middleware; secure cookie in prod | Keep verifying HTMX posts |
| SEC-06 | Admin bypass of workflow states | HIGH | Critical status fields made readonly in admin (pre-UAT hardening) | Break-glass must be documented if ever needed |
| SEC-07 | CSV export formula injection / row cap | MEDIUM | Export capped + truncation marker; org-scoped | Human export UAT pending |
| SEC-08 | Print authorization | MEDIUM | Must remain permission + org scoped | UAT-12 awaiting human |
| SEC-09 | Secrets in repo | CRITICAL if present | `.env` not committed; `.env.example` placeholders only | EXTERNAL: production secrets custody |
| SEC-10 | Bileeta live HTTP | HIGH if enabled without contract | Live disabled without evidence | EXTERNAL BLOCKER |
| SEC-11 | Demo accounts in production | HIGH | Must remain blocked outside local/test | EXTERNAL: production user load |
| SEC-12 | Uploads / path traversal | MEDIUM | Photos/large files not in PostgreSQL; object storage path | Review on media enablement |
| SEC-13 | Subprocess (backup/restore) | MEDIUM | Allowlisted tools; redacted passwords in logs | Keep argv-only invocation |
| SEC-14 | Open redirects | LOW–MEDIUM | Prefer Django defaults; review login `next` | Spot-check on release |
| SEC-15 | Rate limiting login | MEDIUM | Auth lockout / rate settings in `.env.example` | Confirm prod values |
| SEC-16 | Audit immutability | HIGH | Historical quality records preserved; amendments pattern | Business process UAT pending |
| SEC-17 | CSP | LOW | Optional env hook; not mandatory claim | ACCEPTED / EXTERNAL if deferred |
| SEC-18 | MaintainPro deep-link | LOW | Must not pass credentials in URL; no iframe | MaintainPro repo path required |

## Classification key

- **CRITICAL / HIGH / MEDIUM / LOW** — technical severity
- **ACCEPTED / EXTERNAL** — requires company or vendor action, not inventable in code

## Residual external items

- Formal security sign-off
- Production secrets, TLS, SMTP credentials
- SoD written policy
- Real device / printer / factory network evidence
- Bileeta contract and credentials

## Sign-off (blank — company)

| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| Security Reviewer | | | |
| IT | | | |
| Business Owner | | | |
| Approved release SHA | | | |
