IF COL_LENGTH(N'dbo.MaintenanceRequest', N'resolutionCode') IS NULL
  ALTER TABLE [dbo].[MaintenanceRequest] ADD [resolutionCode] NVARCHAR(64) NULL;