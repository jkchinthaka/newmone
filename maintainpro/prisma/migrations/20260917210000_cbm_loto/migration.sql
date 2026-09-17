-- Condition monitoring rules/events, LOTO records, ReliabilityPolicy.requireLotoWhenPermitRequires

IF COL_LENGTH(N'dbo.ReliabilityPolicy', N'requireLotoWhenPermitRequires') IS NULL
BEGIN
  ALTER TABLE [dbo].[ReliabilityPolicy] ADD [requireLotoWhenPermitRequires] BIT NOT NULL
    CONSTRAINT [ReliabilityPolicy_requireLotoWhenPermitRequires_df] DEFAULT 1;
END;

IF OBJECT_ID(N'dbo.ConditionMonitoringRule', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[ConditionMonitoringRule] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [measurementType] NVARCHAR(64) NOT NULL,
    [assetId] NVARCHAR(36) NULL,
    [meterId] NVARCHAR(36) NULL,
    [upperWarning] FLOAT(53) NULL,
    [upperCritical] FLOAT(53) NULL,
    [lowerWarning] FLOAT(53) NULL,
    [lowerCritical] FLOAT(53) NULL,
    [consecutiveBreaches] INT NOT NULL CONSTRAINT [ConditionMonitoringRule_consecutiveBreaches_df] DEFAULT 1,
    [actionOnWarning] NVARCHAR(32) NOT NULL CONSTRAINT [ConditionMonitoringRule_actionOnWarning_df] DEFAULT N'ALERT',
    [actionOnCritical] NVARCHAR(32) NOT NULL CONSTRAINT [ConditionMonitoringRule_actionOnCritical_df] DEFAULT N'CREATE_REQUEST',
    [active] BIT NOT NULL CONSTRAINT [ConditionMonitoringRule_active_df] DEFAULT 1,
    [effectiveFrom] DATETIME2 NOT NULL CONSTRAINT [ConditionMonitoringRule_effectiveFrom_df] DEFAULT CURRENT_TIMESTAMP,
    [effectiveTo] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ConditionMonitoringRule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ConditionMonitoringRule_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ConditionMonitoringRule_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
  );
  CREATE INDEX [ConditionMonitoringRule_tenantId_measurementType_active_idx]
    ON [dbo].[ConditionMonitoringRule]([tenantId],[measurementType],[active]);
  CREATE INDEX [ConditionMonitoringRule_tenantId_assetId_active_idx]
    ON [dbo].[ConditionMonitoringRule]([tenantId],[assetId],[active]);
  CREATE INDEX [ConditionMonitoringRule_tenantId_meterId_active_idx]
    ON [dbo].[ConditionMonitoringRule]([tenantId],[meterId],[active]);
  ALTER TABLE [dbo].[ConditionMonitoringRule]
    ADD CONSTRAINT [ConditionMonitoringRule_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.ConditionEvent', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[ConditionEvent] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [ruleId] NVARCHAR(36) NOT NULL,
    [assetId] NVARCHAR(36) NULL,
    [meterId] NVARCHAR(36) NULL,
    [workOrderId] NVARCHAR(36) NULL,
    [severity] NVARCHAR(16) NOT NULL,
    [readingValue] FLOAT(53) NOT NULL,
    [thresholdValue] FLOAT(53) NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [ConditionEvent_status_df] DEFAULT N'OPEN',
    [breachCount] INT NOT NULL CONSTRAINT [ConditionEvent_breachCount_df] DEFAULT 1,
    [message] NVARCHAR(Max) NOT NULL,
    [dedupeKey] NVARCHAR(128) NOT NULL,
    [resolvedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ConditionEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ConditionEvent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ConditionEvent_tenantId_dedupeKey_key] UNIQUE NONCLUSTERED ([tenantId],[dedupeKey])
  );
  CREATE INDEX [ConditionEvent_tenantId_status_severity_idx]
    ON [dbo].[ConditionEvent]([tenantId],[status],[severity]);
  CREATE INDEX [ConditionEvent_tenantId_ruleId_status_idx]
    ON [dbo].[ConditionEvent]([tenantId],[ruleId],[status]);
  CREATE INDEX [ConditionEvent_tenantId_assetId_status_idx]
    ON [dbo].[ConditionEvent]([tenantId],[assetId],[status]);
  ALTER TABLE [dbo].[ConditionEvent]
    ADD CONSTRAINT [ConditionEvent_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[ConditionEvent]
    ADD CONSTRAINT [ConditionEvent_ruleId_fkey]
    FOREIGN KEY ([ruleId]) REFERENCES [dbo].[ConditionMonitoringRule]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[ConditionEvent]
    ADD CONSTRAINT [ConditionEvent_workOrderId_fkey]
    FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.LotoRecord', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[LotoRecord] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [workPermitId] NVARCHAR(36) NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [LotoRecord_status_df] DEFAULT N'DRAFT',
    [energySourcesJson] NVARCHAR(Max) NOT NULL CONSTRAINT [LotoRecord_energySourcesJson_df] DEFAULT N'[]',
    [isolationPointsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [LotoRecord_isolationPointsJson_df] DEFAULT N'[]',
    [lockTagIdsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [LotoRecord_lockTagIdsJson_df] DEFAULT N'[]',
    [isolatedById] NVARCHAR(36) NULL,
    [verifiedById] NVARCHAR(36) NULL,
    [restoredById] NVARCHAR(36) NULL,
    [isolatedAt] DATETIME2 NULL,
    [verifiedAt] DATETIME2 NULL,
    [restoredAt] DATETIME2 NULL,
    [notes] NVARCHAR(Max) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LotoRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LotoRecord_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE INDEX [LotoRecord_tenantId_workOrderId_status_idx]
    ON [dbo].[LotoRecord]([tenantId],[workOrderId],[status]);
  CREATE INDEX [LotoRecord_tenantId_status_idx]
    ON [dbo].[LotoRecord]([tenantId],[status]);
  ALTER TABLE [dbo].[LotoRecord]
    ADD CONSTRAINT [LotoRecord_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[LotoRecord]
    ADD CONSTRAINT [LotoRecord_workOrderId_fkey]
    FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[LotoRecord]
    ADD CONSTRAINT [LotoRecord_workPermitId_fkey]
    FOREIGN KEY ([workPermitId]) REFERENCES [dbo].[WorkPermit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[LotoRecord]
    ADD CONSTRAINT [LotoRecord_isolatedById_fkey]
    FOREIGN KEY ([isolatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[LotoRecord]
    ADD CONSTRAINT [LotoRecord_verifiedById_fkey]
    FOREIGN KEY ([verifiedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[LotoRecord]
    ADD CONSTRAINT [LotoRecord_restoredById_fkey]
    FOREIGN KEY ([restoredById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;
