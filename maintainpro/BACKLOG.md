# Test tenant cleanup backlog

`tenant.create` in `apps/api/test` and `apps/web/e2e-real` was reviewed on 2026-10-20. These specs still leave tenants behind. A correct cleanup is larger than a short fixture delete, so they were not changed in `fix/test-tenant-cleanup`.

## company-requester.integration.spec.ts

`afterAll` on `test/cleanup-specs` deletes the requests, audit rows, notifications, refresh tokens, memberships, invitations, skills, users, role permissions, and `QA_*_REQUESTER` roles created by this spec. It also removes earlier leftovers with the same email and role names, and `req-iso-*` tenants. A department manager pointer or request-history actor that points at one of those fixture users is cleared. The seeded default tenant stays.

## inventory-disposable-mongo.spec.ts

`afterAll` deletes stock movements, idempotency rows, warehouse balances, audit rows, parts, warehouses, and the tenant this suite created. The suite still runs only when `DISPOSABLE_MONGO_URL` is set.

`apps/web/e2e-real` has no `tenant.create`. `verified-stock.integration.spec.ts` and `machine-lookup.integration.spec.ts` already delete the tenants they create.
