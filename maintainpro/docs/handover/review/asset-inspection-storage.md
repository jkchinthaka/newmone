# fix/asset-inspection-storage

Stacked on PR #128 (`fix/evidence-local-disk`). Merge #128 before this pull request.

Asset documents and inspection evidence use the work-order private local-disk provider when `STORAGE_MODE=local` is configured. Production still needs `STORAGE_LOCAL_PRODUCTION` and a private absolute root. New objects get server-generated names, magic-byte MIME checks, the provider size limit, SHA-256 sidecars, and traversal/junction checks.

Downloads stay on authenticated tenant-scoped routes. Storage keys are not returned on asset document payloads. Existing `storedName` and `externalUrl` asset records, and legacy inspection files under cwd `var/evidence`, stay readable.

When storage is not local, asset uploads still try Cloudinary and then cwd `uploads/asset-documents`. Inspection uploads still use `persistEvidenceFileBytes`.

Assumption: a configured local provider takes precedence over Cloudinary for new asset documents. Cloudinary remains the non-local path.

Gates: API tsc 0. Web tsc 0. Web unit 367 pass, 0 fail. Jest `asset-inspection-storage` 8 pass, plus inspection/planning/evidence suites 70 pass (`maxWorkers=2`). `audit:tenant` unapproved 0. `audit:rbac` 972 routes, violations 0.

No schema change and no database writes. Docker, full-stack e2e, and uat-roles were not run. Ports 3040/3041 were not used. qa-reviewer was not available in this pass; this file and the sibling diff are the review export.
