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
F3 matrix milestone | DONE | a66c8474 | permissions view shows Inherited, Granted, or Denied when the flag is on | preview-as-user is not built; the view does not sign in as the user



R1 | DONE | b318a154 | api/web tsc 0; web unit 371; Jest 14/14; tenant 0; RBAC 0; parity OFF/develop 0 and ON/grants 0; qa-reviewer PASS | Preserve omitted Studio links in runtime and seed saves; no DB/server use
R1 commit | DONE | b318a154 | qa-reviewer PASS; gates above | Implementation committed. Diff export context whitespace corrected in follow-up.
R2 | DONE | ae9ade56 | api/web tsc 0; web 371; Jest 3 suites/12 tests; tenant 0; RBAC 0; parity OFF/develop 0 and ON/grants 0; qa-reviewer PASS | Production controllers in real Nest TestingModule + supertest; seven route cases; no fixed ports
R2 commit | DONE | ae9ade56 | qa-reviewer PASS; gates above | pushed; PR126 stays draft
Assumption F3: preview is SUPER_ADMIN-only and targets an active non-SUPER_ADMIN in the active tenant. Preview-marked requests fail closed if the flag/runtime turns OFF; ordinary unmarked OFF requests retain develop behavior.
Assumption F3 bulk: all targets are scope-validated before writes; each user save is independently atomic and audited; existing overrides are reported as conflicts without replacement.
F3 | DONE | ecd0b4a8 | api/web tsc 0; web372; Jest8 suites39 pass plus final preview9 pass; tenant0; RBAC972/0; parity972x27 OFF/develop0 ON/grants0; qa-reviewer PASS | First review FAIL fixed: stale preview now fails closed. Mocked Playwright desktop/mobile pass. 3053 stopped; no DB writes; no migrations; 3040/3041 untouched.
F3 commit | DONE | ecd0b4a8 | latest qa-reviewer PASS; gates above | Pushed; PR126 body updated and remains draft
D4 navigation/version follow-up | DONE | ecd0b4a8 (verified follow-up diff; implementation SHA follows) | api/web tsc0; web377; Jest9 suites53 tests; tenant0; RBAC972/0; parity972x27 OFF/develop0 ON/grants0; qa-reviewer PASS | Server effective-route projection drives primary navigation, specific Admin pages and landing; ON-only 15s/focus profile refresh invalidates queries on version change. Entity action controls remain for later review. Mocked desktop/mobile UI + version-change test PASS; 3053 stopped.
DB preflight | DONE | ecd0b4a8 | Integrated-auth SELECT on maintainpro_e2e_wo_verify succeeded outside sandbox; CREATE TABLE permission=1 | Initial sandbox SSPI error; no data/schema writes; no SA credentials; MaintainProDev/nelna untouched
