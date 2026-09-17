-- Final closure: Supplier tenant ownership, remaining money Decimal, Asset hierarchy cycle trigger

/* ---------- Supplier.tenantId required ---------- */
UPDATE s
SET s.[tenantId] = x.[tenantId]
FROM [dbo].[Supplier] s
CROSS APPLY (
  SELECT TOP 1 tenantId FROM (
    SELECT wo.[tenantId]
    FROM [dbo].[VendorRepairCase] vrc
    INNER JOIN [dbo].[WorkOrder] wo ON wo.[id] = vrc.[workOrderId]
    WHERE vrc.[supplierId] = s.[id] AND wo.[tenantId] IS NOT NULL
    UNION ALL
    SELECT po.[tenantId]
    FROM [dbo].[PurchaseOrder] po
    WHERE po.[supplierId] = s.[id] AND po.[tenantId] IS NOT NULL
    UNION ALL
    SELECT vpa.[tenantId]
    FROM [dbo].[VendorPortalAccess] vpa
    WHERE vpa.[supplierId] = s.[id]
    UNION ALL
    SELECT sp.[tenantId]
    FROM [dbo].[SparePart] sp
    WHERE sp.[supplierId] = s.[id] AND sp.[tenantId] IS NOT NULL
  ) u
  WHERE u.[tenantId] IS NOT NULL
) x
WHERE s.[tenantId] IS NULL;

IF EXISTS (SELECT 1 FROM [dbo].[Supplier] WHERE [tenantId] IS NULL)
BEGIN
  DECLARE @quarantineId NVARCHAR(36) = N'legacy-supplier-quarantine';
  IF NOT EXISTS (SELECT 1 FROM [dbo].[Tenant] WHERE [id] = @quarantineId)
  BEGIN
    INSERT INTO [dbo].[Tenant] ([id], [name], [slug], [isActive], [createdAt], [updatedAt])
    VALUES (@quarantineId, N'Legacy Supplier Quarantine', N'legacy-supplier-quarantine', 0, SYSUTCDATETIME(), SYSUTCDATETIME());
  END;
  UPDATE [dbo].[Supplier] SET [tenantId] = @quarantineId WHERE [tenantId] IS NULL;
END;

-- Drop indexes / unique constraints that block ALTER COLUMN (SQL Server unique keys are constraints)
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'Supplier_tenantId_vendorCode_key' AND parent_object_id = OBJECT_ID(N'dbo.Supplier'))
  ALTER TABLE [dbo].[Supplier] DROP CONSTRAINT [Supplier_tenantId_vendorCode_key];
ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Supplier_tenantId_vendorCode_key' AND object_id = OBJECT_ID(N'dbo.Supplier') AND is_unique_constraint = 0)
  DROP INDEX [Supplier_tenantId_vendorCode_key] ON [dbo].[Supplier];

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Supplier_tenantId_idx' AND object_id = OBJECT_ID(N'dbo.Supplier') AND is_unique_constraint = 0 AND is_primary_key = 0)
  DROP INDEX [Supplier_tenantId_idx] ON [dbo].[Supplier];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Supplier_tenantId_blacklisted_idx' AND object_id = OBJECT_ID(N'dbo.Supplier') AND is_unique_constraint = 0 AND is_primary_key = 0)
  DROP INDEX [Supplier_tenantId_blacklisted_idx] ON [dbo].[Supplier];

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.Supplier') AND name = N'tenantId' AND is_nullable = 1
)
  ALTER TABLE [dbo].[Supplier] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Supplier_tenantId_idx' AND object_id = OBJECT_ID(N'dbo.Supplier'))
  CREATE NONCLUSTERED INDEX [Supplier_tenantId_idx] ON [dbo].[Supplier]([tenantId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Supplier_tenantId_blacklisted_idx' AND object_id = OBJECT_ID(N'dbo.Supplier'))
  CREATE NONCLUSTERED INDEX [Supplier_tenantId_blacklisted_idx] ON [dbo].[Supplier]([tenantId], [blacklisted]);
IF COL_LENGTH(N'dbo.Supplier', N'vendorCode') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Supplier_tenantId_vendorCode_key' AND object_id = OBJECT_ID(N'dbo.Supplier'))
  CREATE UNIQUE NONCLUSTERED INDEX [Supplier_tenantId_vendorCode_key]
    ON [dbo].[Supplier]([tenantId], [vendorCode])
    WHERE [vendorCode] IS NOT NULL;

/* ---------- Remaining monetary Float → Decimal (best-effort) ---------- */
DECLARE @alterSql NVARCHAR(MAX);
DECLARE @t SYSNAME, @c SYSNAME, @n BIT;
DECLARE @cols TABLE (tbl SYSNAME, col SYSNAME, nullable BIT);
INSERT INTO @cols(tbl, col, nullable) VALUES
 (N'VehicleBattery', N'costSnapshot', 1),
 (N'UtilityBill', N'ratePerUnit', 0),
 (N'UtilityBill', N'baseCharge', 1),
 (N'UtilityBill', N'taxAmount', 1),
 (N'UtilityBill', N'totalAmount', 0),
 (N'Plan', N'priceMonthly', 0),
 (N'Plan', N'priceYearly', 0),
 (N'StripeInvoice', N'amountDue', 0),
 (N'StripeInvoice', N'amountPaid', 0),
 (N'ChangeRequest', N'estimatedCost', 1),
 (N'ErpImportRow', N'cost', 1),
 (N'MaintenanceSchedule', N'estimatedCost', 1);

DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, nullable FROM @cols;
OPEN c;
FETCH NEXT FROM c INTO @t, @c, @n;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(N'dbo.' + @t, N'U') IS NOT NULL AND COL_LENGTH(N'dbo.' + @t, @c) IS NOT NULL
  BEGIN
    SET @alterSql = N'ALTER TABLE [dbo].[' + @t + N'] ALTER COLUMN [' + @c + N'] DECIMAL(18,2) '
      + CASE WHEN @n = 1 THEN N'NULL' ELSE N'NOT NULL' END;
    BEGIN TRY EXEC(@alterSql); END TRY BEGIN CATCH END CATCH;
  END
  FETCH NEXT FROM c INTO @t, @c, @n;
END
CLOSE c; DEALLOCATE c;

DECLARE @farm TABLE (tbl SYSNAME, col SYSNAME);
INSERT INTO @farm VALUES
 (N'CropCycle', N'seedCostLkr'), (N'CropCycle', N'fertilizerCostLkr'), (N'CropCycle', N'pesticideCostLkr'),
 (N'CropCycle', N'laborCostLkr'), (N'CropCycle', N'irrigationCostLkr'), (N'CropCycle', N'otherCostLkr'),
 (N'CropCycle', N'revenueLkr'),
 (N'HarvestRecord', N'pricePerKgLkr'), (N'HarvestRecord', N'totalValueLkr'),
 (N'LivestockAnimal', N'purchasePriceLkr'),
 (N'AnimalHealthRecord', N'costLkr'), (N'FeedingLog', N'costLkr'), (N'IrrigationLog', N'costLkr'), (N'SprayLog', N'costLkr'),
 (N'FarmWorker', N'dailyWageLkr'), (N'AttendanceLog', N'wageLkr'),
 (N'FarmExpense', N'amountLkr'), (N'FarmIncome', N'pricePerKgLkr'), (N'FarmIncome', N'totalLkr');

DECLARE @ft SYSNAME, @fc SYSNAME;
DECLARE fcurs CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col FROM @farm;
OPEN fcurs;
FETCH NEXT FROM fcurs INTO @ft, @fc;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(N'dbo.' + @ft, N'U') IS NOT NULL AND COL_LENGTH(N'dbo.' + @ft, @fc) IS NOT NULL
  BEGIN
    SET @alterSql = N'ALTER TABLE [dbo].[' + @ft + N'] ALTER COLUMN [' + @fc + N'] DECIMAL(18,2) NULL';
    BEGIN TRY EXEC(@alterSql); END TRY BEGIN CATCH END CATCH;
  END
  FETCH NEXT FROM fcurs INTO @ft, @fc;
END
CLOSE fcurs; DEALLOCATE fcurs;

/* ---------- Asset hierarchy: self-parent + cross-tenant + cycle via iterative walk ---------- */
IF OBJECT_ID(N'dbo.trg_Asset_no_hierarchy_cycle', N'TR') IS NOT NULL
  DROP TRIGGER [dbo].[trg_Asset_no_hierarchy_cycle];
EXEC(N'
CREATE TRIGGER [dbo].[trg_Asset_no_hierarchy_cycle]
ON [dbo].[Asset]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (
    SELECT 1 FROM inserted i
    WHERE i.[parentAssetId] IS NOT NULL AND i.[parentAssetId] = i.[id]
  )
  BEGIN
    THROW 50020, N''ASSET_CYCLE: Asset cannot be its own parent'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;

  IF EXISTS (
    SELECT 1 FROM inserted i
    INNER JOIN [dbo].[Asset] p ON p.[id] = i.[parentAssetId]
    WHERE i.[parentAssetId] IS NOT NULL AND p.[tenantId] <> i.[tenantId]
  )
  BEGIN
    THROW 50022, N''CROSS_TENANT_FK: Asset.parentAssetId belongs to another tenant'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;

  -- Detect cycles by walking ancestors (bounded depth)
  DECLARE @id NVARCHAR(36), @tenant NVARCHAR(36), @parent NVARCHAR(36), @cur NVARCHAR(36), @depth INT;
  DECLARE ic CURSOR LOCAL FAST_FORWARD FOR
    SELECT i.[id], i.[tenantId], i.[parentAssetId] FROM inserted i WHERE i.[parentAssetId] IS NOT NULL;
  OPEN ic;
  FETCH NEXT FROM ic INTO @id, @tenant, @parent;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    SET @cur = @parent;
    SET @depth = 0;
    WHILE @cur IS NOT NULL AND @depth < 100
    BEGIN
      IF @cur = @id
      BEGIN
        CLOSE ic; DEALLOCATE ic;
        THROW 50021, N''ASSET_CYCLE: Parent assignment would create a cycle'', 1;
        ROLLBACK TRANSACTION;
        RETURN;
      END;
      SELECT @cur = a.[parentAssetId]
      FROM [dbo].[Asset] a
      WHERE a.[id] = @cur AND a.[tenantId] = @tenant;
      SET @depth = @depth + 1;
    END
    FETCH NEXT FROM ic INTO @id, @tenant, @parent;
  END
  CLOSE ic; DEALLOCATE ic;
END
');

IF OBJECT_ID(N'dbo.trg_VendorPortalAccess_tenant', N'TR') IS NOT NULL
  DROP TRIGGER [dbo].[trg_VendorPortalAccess_tenant];
EXEC(N'
CREATE TRIGGER [dbo].[trg_VendorPortalAccess_tenant]
ON [dbo].[VendorPortalAccess]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1 FROM inserted i
    INNER JOIN [dbo].[Supplier] s ON s.[id] = i.[supplierId]
    WHERE s.[tenantId] <> i.[tenantId]
  )
  BEGIN
    THROW 50023, N''CROSS_TENANT_FK: VendorPortalAccess.supplierId belongs to another tenant'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;
END
');
