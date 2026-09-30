-- Drop five tables that no API, web, test, script, or view reads or writes.
-- See docs/DATABASE_REPO_MAP.md section 4.2.
--   EmployeeRosterEntry  - rostering was never built; workforce uses EmployeeLeaveRequest
--   VendorContact        - supplier contact details live on Supplier
--   RepairWarranty       - duplicated by EntityWarranty / WarrantyClaim
--   CustomFieldValue     - no code stores custom field values
--   UatScenarioExecution - delivery-phase tracking; no module writes it
-- OrganizationUnit is kept: vw_rpt_dim_branch_site joins it.
--
-- Guard: stop if any of these tables holds rows, so no environment loses data silently.
-- Export the rows first if this fires.

BEGIN TRY

BEGIN TRAN;

DECLARE @rows BIGINT = 0;
SELECT @rows =
    (SELECT COUNT_BIG(*) FROM [dbo].[EmployeeRosterEntry])
  + (SELECT COUNT_BIG(*) FROM [dbo].[UatScenarioExecution])
  + (SELECT COUNT_BIG(*) FROM [dbo].[VendorContact])
  + (SELECT COUNT_BIG(*) FROM [dbo].[RepairWarranty])
  + (SELECT COUNT_BIG(*) FROM [dbo].[CustomFieldValue]);
IF @rows > 0
  THROW 50100, N'DROP_UNUSED_TABLES: one or more tables still hold rows; export them before applying this migration.', 1;

-- DropForeignKey
ALTER TABLE [dbo].[EmployeeRosterEntry] DROP CONSTRAINT [EmployeeRosterEntry_tenantId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[EmployeeRosterEntry] DROP CONSTRAINT [EmployeeRosterEntry_employeeId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[UatScenarioExecution] DROP CONSTRAINT [UatScenarioExecution_tenantId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[VendorContact] DROP CONSTRAINT [VendorContact_supplierId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[RepairWarranty] DROP CONSTRAINT [RepairWarranty_tenantId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[RepairWarranty] DROP CONSTRAINT [RepairWarranty_workOrderId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[RepairWarranty] DROP CONSTRAINT [RepairWarranty_supplierId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[CustomFieldValue] DROP CONSTRAINT [CustomFieldValue_tenantId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[CustomFieldValue] DROP CONSTRAINT [CustomFieldValue_definitionId_fkey];

-- DropTable
DROP TABLE [dbo].[EmployeeRosterEntry];

-- DropTable
DROP TABLE [dbo].[UatScenarioExecution];

-- DropTable
DROP TABLE [dbo].[VendorContact];

-- DropTable
DROP TABLE [dbo].[RepairWarranty];

-- DropTable
DROP TABLE [dbo].[CustomFieldValue];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
