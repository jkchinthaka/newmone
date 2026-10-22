# F1c

DENY on a required key blocks alias satisfaction. `work_orders.manage` plus DENY `work_orders.verify` is 403 on the verify route.
Optional `expiresAt` is stored and ignored once it has passed. The card uses a date input.
Overrides cannot target a SUPER_ADMIN (400 "Change the role instead"). SUPER_ADMIN route checks are unchanged.
The last active SUPER_ADMIN in a tenant cannot be demoted, deactivated, or deleted.
Effective keys are cached per request with `accessConfigVersion`. Flag off does not read overrides or the version.
Delete asks for a removal reason that is not the create reason.
Gates: API tsc 0, web tsc 0, web unit 368, related Jest pass, tenant audit 0, rbac audit 0.
Commit `ae1ea357`. Flag default remains off. No parity suite yet (starts at F2).
