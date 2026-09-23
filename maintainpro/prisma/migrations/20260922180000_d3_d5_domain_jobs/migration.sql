-- D3/D4/D5 domain job completion and release fields on unified WorkOrder

ALTER TABLE [dbo].[WorkOrder] ADD [functionalTestResult] NVARCHAR(32) NULL;
ALTER TABLE [dbo].[WorkOrder] ADD [roadTestResult] NVARCHAR(32) NULL;
ALTER TABLE [dbo].[WorkOrder] ADD [completionMeterReading] FLOAT(53) NULL;
ALTER TABLE [dbo].[WorkOrder] ADD [operatingRestriction] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[WorkOrder] ADD [productionImpact] NVARCHAR(32) NULL;
