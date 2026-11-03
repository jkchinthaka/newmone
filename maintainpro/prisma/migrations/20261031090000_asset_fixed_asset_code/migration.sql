-- Asset.fixedAssetCode: the finance fixed asset register / ERP asset code, so the whole-company
-- asset register (Excel import) can be matched with finance. Additive, nullable.
IF COL_LENGTH(N'dbo.Asset', N'fixedAssetCode') IS NULL
  ALTER TABLE [dbo].[Asset] ADD [fixedAssetCode] NVARCHAR(64) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Asset_tenantId_fixedAssetCode_idx' AND object_id = OBJECT_ID(N'dbo.Asset'))
  CREATE NONCLUSTERED INDEX [Asset_tenantId_fixedAssetCode_idx] ON [dbo].[Asset]([tenantId], [fixedAssetCode]);
