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
