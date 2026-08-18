# Known blockers

See also `OPEN_BLOCKERS.md`. This file is the short operational list.

## Must not stop independent engineering

- Business approval of the four source forms
- Official org/site/shift/product values
- FG-QA-001 approval
- SoD
- SMTP
- Object storage IAM
- Production TLS
- Bileeta credentials
- Identity provider
- Hardware
- Formal UAT
- Go-live approval

## Technical items still open on this continuation

- Full feature-branch pytest + coverage after the latest commits (targeted suites passed)
- Docker full-stack re-validation
- Physical printer / multi-viewport live pass on the latest UI
- Merge to `main` only after full gates are green
- True offline queue (intentionally not implemented)
- XLSX export (CSV only; not renamed)
- COPQ/Yield/full OEE/SPC company limits (no invented numbers)
- Phases 56–100 remain boundaries unless a concrete current use case appears
