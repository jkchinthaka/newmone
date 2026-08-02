# Phase 6C Security Test Matrix

Mandatory — no `test.skip`.

| ID | Assertion |
| --- | --- |
| SEC-CONFIG-001..008 | fixture/weak/placeholder/localhost/wildcard/cookie/SHA/E2E flags |
| SEC-RBAC-001..003 | privileged matrix; sign-off spoof denied; per-user bound |
| SEC-NET-001..002 | edge ownership decision; admin ports not public |
| SEC-TLS-001..002 | secure cookie fixture; HTTP dual opt-in explicit |
| SEC-API-001..002 | readiness protected; swagger default disabled |
| SEC-CONT-001..002 | no privileged; no docker socket |
| SEC-SCAN-001..002 | secret scan structural; image scan OPERATOR |
| SEC-REPO-001 | governance gaps documented |
| SEC-MIG-001..002 | dry-run non-mutating; apply unavailable in CI |