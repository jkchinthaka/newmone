-- Workflow definitions, numbering sequences, temporary repair, vendor portal access,
-- meter corrections, approval delegation, service API keys, custom fields, SoD policies

IF OBJECT_ID(N'dbo.WorkflowDefinition', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[WorkflowDefinition] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [entityType] NVARCHAR(64) NOT NULL,
    [jobDomain] NVARCHAR(32) NULL,
    [description] NVARCHAR(Max) NULL,
    [active] BIT NOT NULL CONSTRAINT [WorkflowDefinition_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkflowDefinition_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkflowDefinition_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkflowDefinition_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
  );
  ALTER TABLE [dbo].[WorkflowDefinition]
    ADD CONSTRAINT [WorkflowDefinition_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.WorkflowVersion', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[WorkflowVersion] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [definitionId] NVARCHAR(36) NOT NULL,
    [version] INT NOT NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [WorkflowVersion_status_df] DEFAULT N'DRAFT',
    [statesJson] NVARCHAR(Max) NOT NULL CONSTRAINT [WorkflowVersion_statesJson_df] DEFAULT N'[]',
    [transitionsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [WorkflowVersion_transitionsJson_df] DEFAULT N'[]',
    [effectiveFrom] DATETIME2 NULL,
    [effectiveTo] DATETIME2 NULL,
    [publishedAt] DATETIME2 NULL,
    [publishedById] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkflowVersion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkflowVersion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkflowVersion_definitionId_version_key] UNIQUE NONCLUSTERED ([definitionId],[version])
  );
  CREATE INDEX [WorkflowVersion_tenantId_status_idx] ON [dbo].[WorkflowVersion]([tenantId],[status]);
  ALTER TABLE [dbo].[WorkflowVersion]
    ADD CONSTRAINT [WorkflowVersion_definitionId_fkey]
    FOREIGN KEY ([definitionId]) REFERENCES [dbo].[WorkflowDefinition]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.NumberingSequence', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[NumberingSequence] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [prefix] NVARCHAR(32) NOT NULL CONSTRAINT [NumberingSequence_prefix_df] DEFAULT N'',
    [padLength] INT NOT NULL CONSTRAINT [NumberingSequence_padLength_df] DEFAULT 6,
    [nextValue] INT NOT NULL CONSTRAINT [NumberingSequence_nextValue_df] DEFAULT 1,
    [resetPolicy] NVARCHAR(32) NOT NULL CONSTRAINT [NumberingSequence_resetPolicy_df] DEFAULT N'NEVER',
    [lastResetAt] DATETIME2 NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [NumberingSequence_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [NumberingSequence_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
  );
  ALTER TABLE [dbo].[NumberingSequence]
    ADD CONSTRAINT [NumberingSequence_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF COL_LENGTH(N'dbo.WorkOrder', N'temporaryRepair') IS NULL
BEGIN
  ALTER TABLE [dbo].[WorkOrder] ADD [temporaryRepair] BIT NOT NULL
    CONSTRAINT [WorkOrder_temporaryRepair_df] DEFAULT 0;
END;
IF COL_LENGTH(N'dbo.WorkOrder', N'temporaryRepairExpiry') IS NULL
BEGIN
  ALTER TABLE [dbo].[WorkOrder] ADD [temporaryRepairExpiry] DATETIME2 NULL;
END;
IF COL_LENGTH(N'dbo.WorkOrder', N'temporaryRepairFollowUpId') IS NULL
BEGIN
  ALTER TABLE [dbo].[WorkOrder] ADD [temporaryRepairFollowUpId] NVARCHAR(36) NULL;
END;
IF COL_LENGTH(N'dbo.WorkOrder', N'workflowVersionId') IS NULL
BEGIN
  ALTER TABLE [dbo].[WorkOrder] ADD [workflowVersionId] NVARCHAR(36) NULL;
END;

IF OBJECT_ID(N'dbo.TemporaryRepairRecord', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[TemporaryRepairRecord] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [reason] NVARCHAR(Max) NOT NULL,
    [temporaryAction] NVARCHAR(Max) NOT NULL,
    [risk] NVARCHAR(Max) NULL,
    [expiryAt] DATETIME2 NOT NULL,
    [ownerId] NVARCHAR(36) NULL,
    [followUpWorkOrderId] NVARCHAR(36) NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [TemporaryRepairRecord_status_df] DEFAULT N'OPEN',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TemporaryRepairRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TemporaryRepairRecord_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE INDEX [TemporaryRepairRecord_tenantId_status_expiryAt_idx]
    ON [dbo].[TemporaryRepairRecord]([tenantId],[status],[expiryAt]);
  ALTER TABLE [dbo].[TemporaryRepairRecord]
    ADD CONSTRAINT [TemporaryRepairRecord_workOrderId_fkey]
    FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.VendorPortalAccess', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[VendorPortalAccess] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [supplierId] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [active] BIT NOT NULL CONSTRAINT [VendorPortalAccess_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorPortalAccess_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VendorPortalAccess_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorPortalAccess_tenantId_supplierId_userId_key] UNIQUE NONCLUSTERED ([tenantId],[supplierId],[userId])
  );
  CREATE INDEX [VendorPortalAccess_tenantId_userId_idx] ON [dbo].[VendorPortalAccess]([tenantId],[userId]);
  ALTER TABLE [dbo].[VendorPortalAccess]
    ADD CONSTRAINT [VendorPortalAccess_supplierId_fkey]
    FOREIGN KEY ([supplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[VendorPortalAccess]
    ADD CONSTRAINT [VendorPortalAccess_userId_fkey]
    FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.MeterCorrection', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[MeterCorrection] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [meterId] NVARCHAR(36) NOT NULL,
    [readingId] NVARCHAR(36) NULL,
    [originalValue] FLOAT(53) NOT NULL,
    [correctedValue] FLOAT(53) NOT NULL,
    [reason] NVARCHAR(Max) NOT NULL,
    [requestedById] NVARCHAR(36) NOT NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [MeterCorrection_status_df] DEFAULT N'PENDING',
    [approvedById] NVARCHAR(36) NULL,
    [approvedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MeterCorrection_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MeterCorrection_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE INDEX [MeterCorrection_tenantId_status_idx] ON [dbo].[MeterCorrection]([tenantId],[status]);
END;

IF OBJECT_ID(N'dbo.ApprovalDelegation', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[ApprovalDelegation] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [delegatorId] NVARCHAR(36) NOT NULL,
    [delegateId] NVARCHAR(36) NOT NULL,
    [scopeJson] NVARCHAR(Max) NOT NULL CONSTRAINT [ApprovalDelegation_scopeJson_df] DEFAULT N'{}',
    [reason] NVARCHAR(Max) NOT NULL,
    [startsAt] DATETIME2 NOT NULL,
    [endsAt] DATETIME2 NOT NULL,
    [active] BIT NOT NULL CONSTRAINT [ApprovalDelegation_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ApprovalDelegation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ApprovalDelegation_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE INDEX [ApprovalDelegation_tenantId_delegateId_active_idx]
    ON [dbo].[ApprovalDelegation]([tenantId],[delegateId],[active]);
END;

IF OBJECT_ID(N'dbo.ServiceApiKey', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[ServiceApiKey] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [keyHash] NVARCHAR(128) NOT NULL,
    [keyPrefix] NVARCHAR(16) NOT NULL,
    [scopesJson] NVARCHAR(Max) NOT NULL CONSTRAINT [ServiceApiKey_scopesJson_df] DEFAULT N'[]',
    [expiresAt] DATETIME2 NULL,
    [revokedAt] DATETIME2 NULL,
    [createdById] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ServiceApiKey_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ServiceApiKey_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ServiceApiKey_keyHash_key] UNIQUE NONCLUSTERED ([keyHash])
  );
  CREATE INDEX [ServiceApiKey_tenantId_idx] ON [dbo].[ServiceApiKey]([tenantId]);
END;

IF OBJECT_ID(N'dbo.CustomFieldDefinition', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[CustomFieldDefinition] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [entityType] NVARCHAR(64) NOT NULL,
    [key] NVARCHAR(64) NOT NULL,
    [label] NVARCHAR(200) NOT NULL,
    [fieldType] NVARCHAR(32) NOT NULL,
    [required] BIT NOT NULL CONSTRAINT [CustomFieldDefinition_required_df] DEFAULT 0,
    [allowedValuesJson] NVARCHAR(Max) NOT NULL CONSTRAINT [CustomFieldDefinition_allowedValuesJson_df] DEFAULT N'[]',
    [validationJson] NVARCHAR(Max) NULL,
    [sortOrder] INT NOT NULL CONSTRAINT [CustomFieldDefinition_sortOrder_df] DEFAULT 0,
    [active] BIT NOT NULL CONSTRAINT [CustomFieldDefinition_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CustomFieldDefinition_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CustomFieldDefinition_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CustomFieldDefinition_tenantId_entityType_key_key] UNIQUE NONCLUSTERED ([tenantId],[entityType],[key])
  );
END;

IF OBJECT_ID(N'dbo.SoDPolicy', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[SoDPolicy] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [transactionType] NVARCHAR(64) NOT NULL,
    [ruleJson] NVARCHAR(Max) NOT NULL,
    [active] BIT NOT NULL CONSTRAINT [SoDPolicy_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SoDPolicy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SoDPolicy_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SoDPolicy_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
  );
END;

IF OBJECT_ID(N'dbo.OutboundWebhook', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[OutboundWebhook] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [url] NVARCHAR(500) NOT NULL,
    [secretHash] NVARCHAR(128) NOT NULL,
    [eventsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [OutboundWebhook_eventsJson_df] DEFAULT N'[]',
    [active] BIT NOT NULL CONSTRAINT [OutboundWebhook_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OutboundWebhook_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OutboundWebhook_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE INDEX [OutboundWebhook_tenantId_active_idx] ON [dbo].[OutboundWebhook]([tenantId],[active]);
END;

IF OBJECT_ID(N'dbo.OutboundWebhookDelivery', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[OutboundWebhookDelivery] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [webhookId] NVARCHAR(36) NOT NULL,
    [eventId] NVARCHAR(64) NOT NULL,
    [eventType] NVARCHAR(64) NOT NULL,
    [status] NVARCHAR(32) NOT NULL,
    [attemptCount] INT NOT NULL CONSTRAINT [OutboundWebhookDelivery_attemptCount_df] DEFAULT 0,
    [lastError] NVARCHAR(Max) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OutboundWebhookDelivery_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OutboundWebhookDelivery_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [OutboundWebhookDelivery_tenantId_eventId_key] UNIQUE NONCLUSTERED ([tenantId],[eventId])
  );
END;
