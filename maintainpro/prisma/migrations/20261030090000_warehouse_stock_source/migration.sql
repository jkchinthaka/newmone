-- Warehouse stock source: ERP (snapshot from Bileeta, unchanged behaviour) or MAINTAINPRO
-- (goods-in recorded in MaintainPro; job issues reduce on-hand). Additive, defaults to ERP.
IF COL_LENGTH(N'dbo.Warehouse', N'stockSource') IS NULL
  ALTER TABLE [dbo].[Warehouse] ADD [stockSource] NVARCHAR(16) NOT NULL
    CONSTRAINT [Warehouse_stockSource_df] DEFAULT N'ERP';
