-- Spare part categories get a lookup code. Additive, nullable.
IF COL_LENGTH('dbo.SparePartCategory', 'code') IS NULL
  ALTER TABLE [dbo].[SparePartCategory] ADD [code] NVARCHAR(64) NULL;
