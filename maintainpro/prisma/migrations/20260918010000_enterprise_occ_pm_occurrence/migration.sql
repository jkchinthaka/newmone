-- Optimistic concurrency versions + first-class PmOccurrence

IF COL_LENGTH(N'dbo.Asset', N'version') IS NULL
  ALTER TABLE [dbo].[Asset] ADD [version] INT NOT NULL CONSTRAINT [Asset_version_df] DEFAULT 1;
IF COL_LENGTH(N'dbo.WorkOrder', N'version') IS NULL
  ALTER TABLE [dbo].[WorkOrder] ADD [version] INT NOT NULL CONSTRAINT [WorkOrder_version_df] DEFAULT 1;
IF COL_LENGTH(N'dbo.MaintenanceRequest', N'version') IS NULL
  ALTER TABLE [dbo].[MaintenanceRequest] ADD [version] INT NOT NULL CONSTRAINT [MaintenanceRequest_version_df] DEFAULT 1;

IF OBJECT_ID(N'dbo.PmOccurrence', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[PmOccurrence] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [planId] NVARCHAR(36) NOT NULL,
    [planRevision] INT NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [PmOccurrence_status_df] DEFAULT N'SCHEDULED',
    [dueAt] DATETIME2 NULL,
    [dueMeterValue] FLOAT(53) NULL,
    [graceEndsAt] DATETIME2 NULL,
    [generationKey] NVARCHAR(128) NOT NULL,
    [workOrderId] NVARCHAR(36) NULL,
    [deferredReason] NVARCHAR(1000) NULL,
    [skippedReason] NVARCHAR(1000) NULL,
    [completedAt] DATETIME2 NULL,
    [missedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PmOccurrence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [PmOccurrence_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PmOccurrence_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'PmOccurrence_tenantId_fkey')
  ALTER TABLE [dbo].[PmOccurrence] ADD CONSTRAINT [PmOccurrence_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'PmOccurrence_planId_fkey')
  ALTER TABLE [dbo].[PmOccurrence] ADD CONSTRAINT [PmOccurrence_planId_fkey]
    FOREIGN KEY ([planId]) REFERENCES [dbo].[PmPlan]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'PmOccurrence_workOrderId_fkey')
  ALTER TABLE [dbo].[PmOccurrence] ADD CONSTRAINT [PmOccurrence_workOrderId_fkey]
    FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PmOccurrence_tenantId_planId_generationKey_key' AND object_id = OBJECT_ID(N'dbo.PmOccurrence'))
  CREATE UNIQUE NONCLUSTERED INDEX [PmOccurrence_tenantId_planId_generationKey_key]
    ON [dbo].[PmOccurrence]([tenantId], [planId], [generationKey]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PmOccurrence_tenantId_status_dueAt_idx' AND object_id = OBJECT_ID(N'dbo.PmOccurrence'))
  CREATE NONCLUSTERED INDEX [PmOccurrence_tenantId_status_dueAt_idx] ON [dbo].[PmOccurrence]([tenantId], [status], [dueAt]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PmOccurrence_tenantId_planId_status_idx' AND object_id = OBJECT_ID(N'dbo.PmOccurrence'))
  CREATE NONCLUSTERED INDEX [PmOccurrence_tenantId_planId_status_idx] ON [dbo].[PmOccurrence]([tenantId], [planId], [status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PmOccurrence_workOrderId_idx' AND object_id = OBJECT_ID(N'dbo.PmOccurrence'))
  CREATE NONCLUSTERED INDEX [PmOccurrence_workOrderId_idx] ON [dbo].[PmOccurrence]([workOrderId]);
