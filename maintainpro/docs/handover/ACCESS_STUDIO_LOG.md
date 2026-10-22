# Access Studio log

Assumption F1c: a DENY on the required key blocks alias satisfaction. A DENY on one alias does not cancel a direct grant of the required key; that denied alias simply does not count as a substitute.
Assumption F1c: expired overrides are ignored for access decisions. The admin list still returns them so they can be removed.
Assumption F1c: expiresAt date-only values are stored at 23:59:59.999Z so the chosen day is included. A past expiry is rejected.
Assumption F1c: a removal reason must be non-empty and must not equal the stored create reason.
Assumption D2: "in a tenant" means the user's home tenantId. Another active SUPER_ADMIN with the same tenantId keeps the change allowed. Moving a user between tenants is not a demotion, deactivation, or deletion.

F1c.1 | DONE | ae1ea357 | api tsc 0; web tsc 0; web unit 368; jest overrides/effective/guard/admin-users/legacy/people/workforce pass; tenant audit 0; rbac audit 0 violations | DENY on work_orders.verify blocks the manage alias
F1c.2 | DONE | ae1ea357 | same | expiresAt + date input; past dates rejected
F1c.3 | DONE | ae1ea357 | same | D1 400 Change the role instead; D2 tenant-scoped last SUPER_ADMIN
F1c.4 | DONE | ae1ea357 | same | request cache; flag off does not read overrides or tenant version
F1c.5 | DONE | ae1ea357 | same | removal reason must differ from the create reason
F2.1 | DONE | b3f248a3 | route inventory 971 from decorator metadata | Jest barrel because tsx does not run Nest decorators
F2.2 | DONE | b3f248a3 | RoleName enum, 27 roles | MaintainProDev was not queried; the live check uses each tenant's Role rows
F2.3 | DONE | b3f248a3 | real RolesGuard and PermissionsGuard, 971 routes x 27 roles, 0 mismatches | zero overrides, seed keys plus the new grants
F2.4 | SUPERSEDED | b3f248a3 | 669 access.* keys were injected into @Permissions | reverted: those keys forced 403 when the flag was off
F2.5 | SUPERSEDED | b3f248a3 | @Permissions added beside @Roles | reverted so controllers match origin/develop for @Roles and @Permissions
F2 fix | DONE | 0750d282 | 200 keys in access-route-keys.ts, one per module and role set, seed version 2 | flag off matches develop guards (971 routes x 27 roles, 0 mismatches); flag on with grants matches flag off (0 mismatches); startup refuses version 2 when grants are missing
F2.6 | DONE | b3f248a3 | seed grants and scripts/ops/grant-access-studio-keys.ts | dry-run is the default; --apply refuses nelna and MaintainProDev; grants now use the consolidated keys
F2.7 | DONE | a66c8474 | MaintainProDev dry-run exit 0, no MISMATCH lines, seed version 2 | helper text removed from the overrides card
F2.8 | DONE | b3f248a3 | startup stays off unless seed version >= 2 and live keys match | one error log, API still boots
F2.9 | DONE | a66c8474 | role-limited badge on the user permissions view | keys still checked inside the services listed in service-role-checks.md
F3 | IN PROGRESS | a66c8474 | permissions view shows Inherited, Granted, or Denied when the flag is on | preview-as-user is not built; the view does not sign in as the user



R1 | DONE | d3563f71 (verified working diff; implementation SHA follows) | api/web tsc 0; web unit 371; Jest 14/14; tenant 0; RBAC 0; parity OFF/develop 0 and ON/grants 0; qa-reviewer PASS | Preserve omitted Studio links in runtime and seed saves; no DB/server use
