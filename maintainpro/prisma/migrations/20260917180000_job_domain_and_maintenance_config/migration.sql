-- Unified maintenance job domains + admin configuration catalogs.

IF COL_LENGTH('dbo.WorkOrder', 'jobDomain') IS NULL
  ALTER TABLE [dbo].[WorkOrder] ADD [jobDomain] NVARCHAR(32) NULL;

IF COL_LENGTH('dbo.MaintenanceRequest', 'jobDomain') IS NULL
  ALTER TABLE [dbo].[MaintenanceRequest] ADD [jobDomain] NVARCHAR(32) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'WorkOrder_tenantId_jobDomain_idx' AND object_id = OBJECT_ID(N'dbo.WorkOrder'))
  CREATE INDEX [WorkOrder_tenantId_jobDomain_idx] ON [dbo].[WorkOrder]([tenantId], [jobDomain]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'WorkOrder_tenantId_jobDomain_status_idx' AND object_id = OBJECT_ID(N'dbo.WorkOrder'))
  CREATE INDEX [WorkOrder_tenantId_jobDomain_status_idx] ON [dbo].[WorkOrder]([tenantId], [jobDomain], [status]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'MaintenanceRequest_tenantId_jobDomain_idx' AND object_id = OBJECT_ID(N'dbo.MaintenanceRequest'))
  CREATE INDEX [MaintenanceRequest_tenantId_jobDomain_idx] ON [dbo].[MaintenanceRequest]([tenantId], [jobDomain]);

IF OBJECT_ID(N'dbo.MaintenanceJobCategory', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[MaintenanceJobCategory] (
      [id] NVARCHAR(36) NOT NULL,
      [tenantId] NVARCHAR(36) NOT NULL,
      [jobDomain] NVARCHAR(32) NOT NULL,
      [level] NVARCHAR(16) NOT NULL,
      [parentId] NVARCHAR(36) NULL,
      [code] NVARCHAR(64) NOT NULL,
      [name] NVARCHAR(200) NOT NULL,
      [active] BIT NOT NULL CONSTRAINT [MaintenanceJobCategory_active_df] DEFAULT 1,
      [sortOrder] INT NOT NULL CONSTRAINT [MaintenanceJobCategory_sortOrder_df] DEFAULT 0,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceJobCategory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL,
      CONSTRAINT [MaintenanceJobCategory_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [MaintenanceJobCategory_tenantId_jobDomain_code_key] UNIQUE NONCLUSTERED ([tenantId],[jobDomain],[code])
  );

  CREATE INDEX [MaintenanceJobCategory_tenantId_jobDomain_level_active_idx]
    ON [dbo].[MaintenanceJobCategory]([tenantId], [jobDomain], [level], [active]);
  CREATE INDEX [MaintenanceJobCategory_tenantId_parentId_idx]
    ON [dbo].[MaintenanceJobCategory]([tenantId], [parentId]);

  ALTER TABLE [dbo].[MaintenanceJobCategory]
    ADD CONSTRAINT [MaintenanceJobCategory_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

  ALTER TABLE [dbo].[MaintenanceJobCategory]
    ADD CONSTRAINT [MaintenanceJobCategory_parentId_fkey]
    FOREIGN KEY ([parentId]) REFERENCES [dbo].[MaintenanceJobCategory]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.PrioritySlaRule', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[PrioritySlaRule] (
      [id] NVARCHAR(36) NOT NULL,
      [tenantId] NVARCHAR(36) NOT NULL,
      [priority] NVARCHAR(32) NOT NULL,
      [responseMinutes] INT NULL,
      [completionMinutes] INT NULL,
      [escalateOnBreach] BIT NOT NULL CONSTRAINT [PrioritySlaRule_escalateOnBreach_df] DEFAULT 1,
      [notifyOnBreach] BIT NOT NULL CONSTRAINT [PrioritySlaRule_notifyOnBreach_df] DEFAULT 1,
      [active] BIT NOT NULL CONSTRAINT [PrioritySlaRule_active_df] DEFAULT 1,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [PrioritySlaRule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL,
      CONSTRAINT [PrioritySlaRule_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [PrioritySlaRule_tenantId_priority_key] UNIQUE NONCLUSTERED ([tenantId],[priority])
  );

  CREATE INDEX [PrioritySlaRule_tenantId_active_idx] ON [dbo].[PrioritySlaRule]([tenantId], [active]);

  ALTER TABLE [dbo].[PrioritySlaRule]
    ADD CONSTRAINT [PrioritySlaRule_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

-- Backfill in dynamic SQL so the new column is visible after ALTER in the same batch.
EXEC(N'
UPDATE wo
SET wo.[jobDomain] = CASE
  WHEN wo.[vehicleId] IS NOT NULL THEN N''VEHICLE''
  WHEN wo.[assetId] IS NOT NULL THEN N''MACHINERY''
  ELSE N''SERVICE''
END
FROM [dbo].[WorkOrder] wo
WHERE wo.[jobDomain] IS NULL;

UPDATE mr
SET mr.[jobDomain] = CASE
  WHEN mr.[assetId] IS NOT NULL THEN N''MACHINERY''
  ELSE N''SERVICE''
END
FROM [dbo].[MaintenanceRequest] mr
WHERE mr.[jobDomain] IS NULL;
');