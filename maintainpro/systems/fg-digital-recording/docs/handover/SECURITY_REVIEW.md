# Security review notes

This is an engineering self-review aid, not a signed security assessment.

## Controls present

- Deny-by-default RBAC with organization scope
- CSRF on normal form posts (do not use `HTMLFormElement.submit()` shortcuts in tests)
- Immutable submissions and review rows
- Private evidence attachments (not in PostgreSQL)
- CSV formula-injection neutralization
- Print/history/export reuse recording authorization
- Restore drill SQL uses validated identifiers / psql variables
- Synthetic workload restricts URL schemes to http/https

## Residual review items

- Cross-org IDOR regression on every new URL (UAT-17)
- Upload/malware scanner still NOT_CONFIGURED
- Object-store IAM EVIDENCE REQUIRED
- SSO/MFA/IdP credentials not invented — external configuration required
- Webhooks/SSRF remain boundary-only
- DEBT-01C-R-NOTO is accessibility/font evidence, not a secret issue

## Classification

Security review for go-live remains **OWNER REQUIRED**.
