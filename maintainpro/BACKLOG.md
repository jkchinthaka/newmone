# Test tenant cleanup backlog

`tenant.create` in `apps/api/test` and `apps/web/e2e-real` was reviewed on 2026-10-20. These specs still leave tenants behind. A correct cleanup is larger than a short fixture delete, so they were not changed in `fix/test-tenant-cleanup`.

## company-requester.integration.spec.ts

`afterAll` deletes only the maintenance requests the test records. The test also creates an isolation tenant (`Requester isolation tenant` / `req-iso-*`) and, on the seeded `default` tenant, one role, its permission links, and one user for each department. Cleaning that up has to keep the seeded tenant and follow every row `MaintenanceRequestsService.create` writes on that shared tenant.

## inventory-disposable-mongo.spec.ts

`afterAll` only disconnects. The suite is skipped unless `DISPOSABLE_MONGO_URL` is set. It creates a tenant plus inventory ledger rows on Mongo, not on SQL Server.

`apps/web/e2e-real` has no `tenant.create`. `verified-stock.integration.spec.ts` and `machine-lookup.integration.spec.ts` already delete the tenants they create.
