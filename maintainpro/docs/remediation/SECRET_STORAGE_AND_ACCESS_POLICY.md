# Secret Storage and Access Policy

## Approved storage

- GitHub Actions secrets / environment secrets
- Organization password manager
- Cloud secret manager
- Protected server environment file (operator host, not Git)
- OS certificate store (TLS)

## Rules

- Secrets never in Git, Compose defaults, image layers, logs, screenshots, or UAT documents.
- Least-privilege operator access; named users only.
- Break-glass: dual control + audited temporary access + expiry.
- Access review: MANAGEMENT_APPROVAL_REQUIRED cadence.
- Revocation: disable credential, rotate dependents, verify readiness.