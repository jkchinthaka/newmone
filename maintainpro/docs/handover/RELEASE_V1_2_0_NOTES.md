# Release notes — v1.2.0

Develop `0a652598` on 2026-10-22. No tag. Not merged to `main`. `MaintainProDev` was not migrated.

## On develop

- #116 Approve & assign in one dialog, and Verify & close. The work order list keeps `version` so verification can send `expectedVersion`.
- #117 Light-theme screenshots for work orders, approvals, fleet, and spare parts at 1440 and 390.
- #118 My requests.
- #119 Work order cost, SLA, and open assignment load. The phase 3 HTTP test provides the insights service the controller now requires.

## Not merged

- #120 Gate history. Additive `GateCheck` migration. `fresh-sqlserver-migrate` was green. Review copy: `docs/handover/review/gate-check-migration.sql` (uncommitted). Do not apply it to `MaintainProDev`.
- #122 Access Studio phase F1. Review copy: `docs/handover/review/access-studio-f1.diff` (uncommitted). Independent review could not run because of a billing block. That is not a failing review. Do not merge until that security review is done.

## Migrations

Neither migration is on develop.

- `GateCheck` (PR #120): id, tenantId, vehicleId, checkedById, result, reasons, createdAt. Additive create-if-missing.
- `UserPermissionOverride` (PR #122): id, tenantId, userId, permissionKey, effect `GRANT` or `DENY`, reason, createdById, createdAt. Unique on tenant, user, and permission key. Additive create-if-missing.

## ACCESS_STUDIO_ENABLED

Defaults off. Off means effective permissions are the role permissions and the override table is not read. On means role permissions plus GRANT minus DENY, and DENY wins. Only the permissions guard and the `/auth/me` permission list use that result. `SUPER_ADMIN` stays allowed without reading overrides. No `@Roles` check was changed. A user cannot edit their own overrides.

## Manual QA

- Pending work order: one Approve & assign dialog, then the order is approved and assigned. If assign fails, it stays approved and the error is shown.
- After technician completion, Verify & close verifies and closes.
- My requests page for the signed-in requester.
- Work order cost, SLA, and assignment load on the work order.
- Work orders, approvals, fleet, and spare parts stay light at desktop and phone width.
- Leave permission overrides alone until `ACCESS_STUDIO_ENABLED` is on in a reviewed environment.

## Local checks

- API and web `tsc`: pass.
- Web unit tests: 365 pass.
- `audit:tenant`: 0 unapproved. `audit:rbac`: 0 violations.
- API Jest `--maxWorkers=2` on disposable database `maintainpro_e2e_wo_verify`: 266 suites passed, 5 skipped, 2202 tests passed, 35 skipped.
- `wo-flow-v103` on a temporary stack (ports 3052 and 3053), then stopped: 1 passed. Canonical 3040 and 3041 were left running.
- `test:e2e:full-stack` and `uat-roles`: not executed. The Docker engine pipe is missing, so the stack on port 18080 was not started. This is an environment gap, not a product failure.
