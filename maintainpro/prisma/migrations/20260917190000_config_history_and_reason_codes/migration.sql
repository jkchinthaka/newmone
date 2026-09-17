IF OBJECT_ID(N'dbo.MaintenanceReasonCode', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[MaintenanceReasonCode] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [kind] NVARCHAR(16) NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(Max) NULL,
    [requiresNotes] BIT NOT NULL CONSTRAINT [MaintenanceReasonCode_requiresNotes_df] DEFAULT 0,
    [sortOrder] INT NOT NULL CONSTRAINT [MaintenanceReasonCode_sortOrder_df] DEFAULT 0,
    [active] BIT NOT NULL CONSTRAINT [MaintenanceReasonCode_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceReasonCode_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MaintenanceReasonCode_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MaintenanceReasonCode_tenantId_kind_code_key] UNIQUE NONCLUSTERED ([tenantId],[kind],[code])
  );
  CREATE INDEX [MaintenanceReasonCode_tenantId_kind_active_idx]
    ON [dbo].[MaintenanceReasonCode]([tenantId], [kind], [active]);
  ALTER TABLE [dbo].[MaintenanceReasonCode]
    ADD CONSTRAINT [MaintenanceReasonCode_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.ConfigChangeHistory', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[ConfigChangeHistory] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [entityType] NVARCHAR(64) NOT NULL,
    [entityId] NVARCHAR(36) NOT NULL,
    [action] NVARCHAR(32) NOT NULL,
    [reason] NVARCHAR(Max) NULL,
    [beforeJson] NVARCHAR(Max) NULL,
    [afterJson] NVARCHAR(Max) NULL,
    [version] INT NOT NULL CONSTRAINT [ConfigChangeHistory_version_df] DEFAULT 1,
    [actorId] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ConfigChangeHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ConfigChangeHistory_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE INDEX [ConfigChangeHistory_tenantId_entityType_entityId_createdAt_idx]
    ON [dbo].[ConfigChangeHistory]([tenantId], [entityType], [entityId], [createdAt]);
  CREATE INDEX [ConfigChangeHistory_tenantId_createdAt_idx]
    ON [dbo].[ConfigChangeHistory]([tenantId], [createdAt]);
  ALTER TABLE [dbo].[ConfigChangeHistory]
    ADD CONSTRAINT [ConfigChangeHistory_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[ConfigChangeHistory]
    ADD CONSTRAINT [ConfigChangeHistory_actorId_fkey]
    FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;