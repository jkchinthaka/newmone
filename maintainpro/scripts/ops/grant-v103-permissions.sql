-- Idempotent grants for v1.0.3. The TypeScript runner is the supported path.
-- It never deletes permissions or approver levels.
-- Run only against a maintainpro_e2e_* database. Do not run against MaintainProDev.

-- Permission row
-- INSERT INTO Permission (id, [key], description, createdAt, updatedAt)
-- SELECT NEWID(), 'maintenance_requests.create', 'maintenance_requests.create', SYSUTCDATETIME(), SYSUTCDATETIME()
-- WHERE NOT EXISTS (SELECT 1 FROM Permission WHERE [key] = 'maintenance_requests.create');

-- Role links for SUPER_ADMIN, ADMIN, MANAGER, TECHNICIAN, SECURITY_OFFICER, INVENTORY_KEEPER
-- are inserted only when the (roleId, permissionId) pair is missing.

-- FINANCE-only approval rules gain MANAGER and ADMIN levels at the next free level.
-- Existing FINANCE levels stay.
