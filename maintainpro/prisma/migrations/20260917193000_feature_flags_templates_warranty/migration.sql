-- Tenant feature flags, maintenance templates, entity warranties, WO template snapshot columns

IF COL_LENGTH(N'dbo.WorkOrder', N'maintenanceTemplateId') IS NULL
BEGIN
  ALTER TABLE [dbo].[WorkOrder] ADD [maintenanceTemplateId] NVARCHAR(36) NULL;
END;

IF COL_LENGTH(N'dbo.WorkOrder', N'maintenanceTemplateVersion') IS NULL
BEGIN
  ALTER TABLE [dbo].[WorkOrder] ADD [maintenanceTemplateVersion] INT NULL;
END;

IF COL_LENGTH(N'dbo.WorkOrder', N'maintenanceTemplateSnapshot') IS NULL
BEGIN
  ALTER TABLE [dbo].[WorkOrder] ADD [maintenanceTemplateSnapshot] NVARCHAR(Max) NULL;
END;

IF COL_LENGTH(N'dbo.WorkOrder', N'underWarranty') IS NULL
BEGIN
  ALTER TABLE [dbo].[WorkOrder] ADD [underWarranty] BIT NOT NULL
    CONSTRAINT [WorkOrder_underWarranty_df] DEFAULT 0;
END;

IF OBJECT_ID(N'dbo.TenantFeatureFlag', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[TenantFeatureFlag] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(Max) NULL,
    [enabled] BIT NOT NULL CONSTRAINT [TenantFeatureFlag_enabled_df] DEFAULT 1,
    [effectiveFrom] DATETIME2 NOT NULL CONSTRAINT [TenantFeatureFlag_effectiveFrom_df] DEFAULT CURRENT_TIMESTAMP,
    [effectiveTo] DATETIME2 NULL,
    [configJson] NVARCHAR(Max) NULL,
    [updatedById] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TenantFeatureFlag_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TenantFeatureFlag_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TenantFeatureFlag_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
  );
  CREATE INDEX [TenantFeatureFlag_tenantId_enabled_idx] ON [dbo].[TenantFeatureFlag]([tenantId],[enabled]);
  ALTER TABLE [dbo].[TenantFeatureFlag]
    ADD CONSTRAINT [TenantFeatureFlag_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[TenantFeatureFlag]
    ADD CONSTRAINT [TenantFeatureFlag_updatedById_fkey]
    FOREIGN KEY ([updatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.MaintenanceTemplate', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[MaintenanceTemplate] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(Max) NULL,
    [jobDomain] NVARCHAR(32) NOT NULL,
    [jobType] NVARCHAR(64) NULL,
    [categoryCode] NVARCHAR(64) NULL,
    [subcategoryCode] NVARCHAR(64) NULL,
    [defaultPriority] NVARCHAR(32) NOT NULL CONSTRAINT [MaintenanceTemplate_defaultPriority_df] DEFAULT 'MEDIUM',
    [estimatedHours] FLOAT(53) NULL,
    [estimatedDowntimeMin] INT NULL,
    [defaultExecutionMode] NVARCHAR(32) NULL,
    [requiredSkillsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [MaintenanceTemplate_requiredSkillsJson_df] DEFAULT '[]',
    [defaultPartsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [MaintenanceTemplate_defaultPartsJson_df] DEFAULT '[]',
    [safetyRequirementsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [MaintenanceTemplate_safetyRequirementsJson_df] DEFAULT '[]',
    [permitRequirement] NVARCHAR(64) NULL,
    [checklistTemplateId] NVARCHAR(36) NULL,
    [signOffRequirementsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [MaintenanceTemplate_signOffRequirementsJson_df] DEFAULT '[]',
    [instructions] NVARCHAR(Max) NULL,
    [documentsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [MaintenanceTemplate_documentsJson_df] DEFAULT '[]',
    [version] INT NOT NULL CONSTRAINT [MaintenanceTemplate_version_df] DEFAULT 1,
    [effectiveFrom] DATETIME2 NOT NULL CONSTRAINT [MaintenanceTemplate_effectiveFrom_df] DEFAULT CURRENT_TIMESTAMP,
    [effectiveTo] DATETIME2 NULL,
    [active] BIT NOT NULL CONSTRAINT [MaintenanceTemplate_active_df] DEFAULT 1,
    [createdById] NVARCHAR(36) NULL,
    [updatedById] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MaintenanceTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MaintenanceTemplate_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MaintenanceTemplate_tenantId_code_version_key] UNIQUE NONCLUSTERED ([tenantId],[code],[version])
  );
  CREATE INDEX [MaintenanceTemplate_tenantId_jobDomain_active_idx]
    ON [dbo].[MaintenanceTemplate]([tenantId],[jobDomain],[active]);
  CREATE INDEX [MaintenanceTemplate_tenantId_code_active_idx]
    ON [dbo].[MaintenanceTemplate]([tenantId],[code],[active]);
  ALTER TABLE [dbo].[MaintenanceTemplate]
    ADD CONSTRAINT [MaintenanceTemplate_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[MaintenanceTemplate]
    ADD CONSTRAINT [MaintenanceTemplate_checklistTemplateId_fkey]
    FOREIGN KEY ([checklistTemplateId]) REFERENCES [dbo].[ChecklistTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[MaintenanceTemplate]
    ADD CONSTRAINT [MaintenanceTemplate_createdById_fkey]
    FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[MaintenanceTemplate]
    ADD CONSTRAINT [MaintenanceTemplate_updatedById_fkey]
    FOREIGN KEY ([updatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.EntityWarranty', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[EntityWarranty] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [subjectType] NVARCHAR(32) NOT NULL,
    [subjectId] NVARCHAR(36) NOT NULL,
    [provider] NVARCHAR(200) NOT NULL,
    [reference] NVARCHAR(128) NULL,
    [coverageType] NVARCHAR(64) NULL,
    [coverageNotes] NVARCHAR(Max) NULL,
    [startDate] DATETIME2 NOT NULL,
    [endDate] DATETIME2 NOT NULL,
    [mileageLimit] INT NULL,
    [hourLimit] FLOAT(53) NULL,
    [documentUrlsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [EntityWarranty_documentUrlsJson_df] DEFAULT '[]',
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [EntityWarranty_status_df] DEFAULT 'ACTIVE',
    [policyAction] NVARCHAR(32) NOT NULL CONSTRAINT [EntityWarranty_policyAction_df] DEFAULT 'WARN',
    [createdById] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EntityWarranty_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EntityWarranty_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE INDEX [EntityWarranty_tenantId_subjectType_subjectId_idx]
    ON [dbo].[EntityWarranty]([tenantId],[subjectType],[subjectId]);
  CREATE INDEX [EntityWarranty_tenantId_status_endDate_idx]
    ON [dbo].[EntityWarranty]([tenantId],[status],[endDate]);
  CREATE INDEX [EntityWarranty_tenantId_endDate_idx]
    ON [dbo].[EntityWarranty]([tenantId],[endDate]);
  ALTER TABLE [dbo].[EntityWarranty]
    ADD CONSTRAINT [EntityWarranty_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[EntityWarranty]
    ADD CONSTRAINT [EntityWarranty_createdById_fkey]
    FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.WarrantyClaim', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[WarrantyClaim] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [warrantyId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NULL,
    [claimNumber] NVARCHAR(64) NOT NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [WarrantyClaim_status_df] DEFAULT 'ELIGIBLE',
    [claimAmount] DECIMAL(18,2) NULL,
    [approvedAmount] DECIMAL(18,2) NULL,
    [recoveredAmount] DECIMAL(18,2) NULL,
    [currency] NVARCHAR(8) NOT NULL CONSTRAINT [WarrantyClaim_currency_df] DEFAULT 'LKR',
    [submittedAt] DATETIME2 NULL,
    [responseAt] DATETIME2 NULL,
    [documentUrlsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [WarrantyClaim_documentUrlsJson_df] DEFAULT '[]',
    [notes] NVARCHAR(Max) NULL,
    [createdById] NVARCHAR(36) NULL,
    [updatedById] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WarrantyClaim_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WarrantyClaim_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WarrantyClaim_tenantId_claimNumber_key] UNIQUE NONCLUSTERED ([tenantId],[claimNumber])
  );
  CREATE INDEX [WarrantyClaim_tenantId_status_idx] ON [dbo].[WarrantyClaim]([tenantId],[status]);
  CREATE INDEX [WarrantyClaim_tenantId_warrantyId_idx] ON [dbo].[WarrantyClaim]([tenantId],[warrantyId]);
  CREATE INDEX [WarrantyClaim_tenantId_workOrderId_idx] ON [dbo].[WarrantyClaim]([tenantId],[workOrderId]);
  ALTER TABLE [dbo].[WarrantyClaim]
    ADD CONSTRAINT [WarrantyClaim_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[WarrantyClaim]
    ADD CONSTRAINT [WarrantyClaim_warrantyId_fkey]
    FOREIGN KEY ([warrantyId]) REFERENCES [dbo].[EntityWarranty]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[WarrantyClaim]
    ADD CONSTRAINT [WarrantyClaim_workOrderId_fkey]
    FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[WarrantyClaim]
    ADD CONSTRAINT [WarrantyClaim_createdById_fkey]
    FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[WarrantyClaim]
    ADD CONSTRAINT [WarrantyClaim_updatedById_fkey]
    FOREIGN KEY ([updatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'WorkOrder_tenantId_maintenanceTemplateId_idx' AND object_id = OBJECT_ID(N'dbo.WorkOrder')
)
BEGIN
  CREATE INDEX [WorkOrder_tenantId_maintenanceTemplateId_idx]
    ON [dbo].[WorkOrder]([tenantId],[maintenanceTemplateId]);
END;

IF COL_LENGTH(N'dbo.WorkOrder', N'maintenanceTemplateId') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'WorkOrder_maintenanceTemplateId_fkey'
  )
BEGIN
  ALTER TABLE [dbo].[WorkOrder]
    ADD CONSTRAINT [WorkOrder_maintenanceTemplateId_fkey]
    FOREIGN KEY ([maintenanceTemplateId]) REFERENCES [dbo].[MaintenanceTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;
