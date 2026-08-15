# Validation Strategy

**Document status:** Draft strategy — no validation completed in Phase 00  
**Phase:** 00 — Discovery and governance  
**Last updated:** 2026-08-04

## Objectives

Demonstrate that security, workflow, data integrity, and user journeys meet approved requirements before production claims.

## Unit tests

Pytest unit tests for services, selectors, policies, and pure helpers.

## Integration tests

Multi-model workflow tests against PostgreSQL for submit/check/verify/amend and audit emission.

## Authorization tests

Deny-by-default, scoped roles, and separation-of-duty cases with positive and negative assertions.

## Workflow tests

End-to-end business workflows at API/service level for MVP paths.

## PostgreSQL transaction tests

Assert multi-record operations commit/rollback atomically.

## Browser tests

Playwright coverage for critical operator, supervisor, and QA journeys on supported breakpoints.

## Offline tests

Required before enabling Phase 14 offline: draft persistence, resume, sync, duplicate prevention, conflict handling.

## Performance tests

Measure against **PROPOSED** NFR targets once environments exist; adjust only with owner approval.

## Security tests

Authentication failures, privilege escalation attempts, CSRF protections, and evidence access controls.

## UAT

Business and QA acceptance on UAT with approved scripts and traceability to requirement IDs.

## Installation verification

Confirm deployable configuration, migrations, static assets, object storage connectivity, and worker processes for the target environment.

## Operational verification

Smoke checks for login, task list, submit, check, verify, evidence upload, and audit export in the target environment.

## Performance verification

Confirm agreed performance targets in a representative environment before production claims.

## Traceability

Link tests and UAT scripts to [TRACEABILITY_MATRIX.md](../requirements/TRACEABILITY_MATRIX.md).

## Test evidence

Retain logs, reports, and screenshots as required by QA/IT. Phase 00 has no test evidence yet.

## Deviations

Record deviations; they do not silently become accepted behavior.

## Release approval

Production release requires UAT completion, restore testing, security review, and named owner approvals. Until then, the system is not production-ready.
