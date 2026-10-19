-- Additive vendor tax rate. Existing invoice and quotation amounts are not rewritten.
IF COL_LENGTH(N'dbo.VendorInvoice', N'taxRatePercent') IS NULL
  ALTER TABLE [dbo].[VendorInvoice] ADD [taxRatePercent] DECIMAL(5, 2) NULL;

IF COL_LENGTH(N'dbo.VendorQuotation', N'taxRatePercent') IS NULL
  ALTER TABLE [dbo].[VendorQuotation] ADD [taxRatePercent] DECIMAL(5, 2) NULL;

IF COL_LENGTH(N'dbo.VendorQuotation', N'taxAmount') IS NULL
  ALTER TABLE [dbo].[VendorQuotation] ADD [taxAmount] DECIMAL(18, 2) NULL;

IF COL_LENGTH(N'dbo.VendorQuotation', N'totalAmount') IS NULL
  ALTER TABLE [dbo].[VendorQuotation] ADD [totalAmount] DECIMAL(18, 2) NULL;

IF OBJECT_ID(N'dbo.TenantMaintenanceSetting', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[TenantMaintenanceSetting] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [defaultTaxRatePercent] DECIMAL(5, 2) NOT NULL,
    [updatedById] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TenantMaintenanceSetting_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [TenantMaintenanceSetting_updatedAt_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [TenantMaintenanceSetting_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TenantMaintenanceSetting_tenantId_key] UNIQUE NONCLUSTERED ([tenantId]),
    CONSTRAINT [TenantMaintenanceSetting_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id])
  );
END;

-- Seed the Sri Lanka standard VAT rate as stored tenant data for tenants that do not have a setting yet.
INSERT INTO [dbo].[TenantMaintenanceSetting] ([id], [tenantId], [defaultTaxRatePercent])
SELECT CONVERT(NVARCHAR(36), NEWID()), [t].[id], 18
FROM [dbo].[Tenant] AS [t]
WHERE NOT EXISTS (
  SELECT 1 FROM [dbo].[TenantMaintenanceSetting] AS [s] WHERE [s].[tenantId] = [t].[id]
);
