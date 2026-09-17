-- Downtime segments, RCA/CAPA, WorkPermit, ReliabilityPolicy, WO.repeatFailureCandidate

IF COL_LENGTH(N'dbo.WorkOrder', N'repeatFailureCandidate') IS NULL
BEGIN
  ALTER TABLE [dbo].[WorkOrder] ADD [repeatFailureCandidate] BIT NOT NULL
    CONSTRAINT [WorkOrder_repeatFailureCandidate_df] DEFAULT 0;
END;

IF OBJECT_ID(N'dbo.ReliabilityPolicy', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[ReliabilityPolicy] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [repeatWindowDays] INT NOT NULL CONSTRAINT [ReliabilityPolicy_repeatWindowDays_df] DEFAULT 90,
    [matchSameFaultCode] BIT NOT NULL CONSTRAINT [ReliabilityPolicy_matchSameFaultCode_df] DEFAULT 1,
    [matchSameAsset] BIT NOT NULL CONSTRAINT [ReliabilityPolicy_matchSameAsset_df] DEFAULT 1,
    [requireRcaOnRepeat] BIT NOT NULL CONSTRAINT [ReliabilityPolicy_requireRcaOnRepeat_df] DEFAULT 0,
    [requirePermitForCriticalAssets] BIT NOT NULL CONSTRAINT [ReliabilityPolicy_requirePermitForCriticalAssets_df] DEFAULT 1,
    [permitRequiredCriticalities] NVARCHAR(128) NOT NULL CONSTRAINT [ReliabilityPolicy_permitRequiredCriticalities_df] DEFAULT N'CRITICAL,HIGH',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ReliabilityPolicy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ReliabilityPolicy_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ReliabilityPolicy_tenantId_key] UNIQUE NONCLUSTERED ([tenantId])
  );
  ALTER TABLE [dbo].[ReliabilityPolicy]
    ADD CONSTRAINT [ReliabilityPolicy_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.DowntimeSegment', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[DowntimeSegment] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [assetId] NVARCHAR(36) NULL,
    [category] NVARCHAR(32) NOT NULL,
    [planned] BIT NOT NULL CONSTRAINT [DowntimeSegment_planned_df] DEFAULT 0,
    [reasonCode] NVARCHAR(64) NULL,
    [reasonNotes] NVARCHAR(Max) NULL,
    [startedAt] DATETIME2 NOT NULL,
    [endedAt] DATETIME2 NULL,
    [productionAffected] BIT NOT NULL CONSTRAINT [DowntimeSegment_productionAffected_df] DEFAULT 0,
    [estimatedLostHours] FLOAT(53) NULL,
    [estimatedLostUnits] FLOAT(53) NULL,
    [openedById] NVARCHAR(36) NULL,
    [closedById] NVARCHAR(36) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DowntimeSegment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DowntimeSegment_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE INDEX [DowntimeSegment_tenantId_workOrderId_startedAt_idx]
    ON [dbo].[DowntimeSegment]([tenantId],[workOrderId],[startedAt]);
  CREATE INDEX [DowntimeSegment_tenantId_assetId_startedAt_idx]
    ON [dbo].[DowntimeSegment]([tenantId],[assetId],[startedAt]);
  CREATE INDEX [DowntimeSegment_tenantId_category_endedAt_idx]
    ON [dbo].[DowntimeSegment]([tenantId],[category],[endedAt]);
  ALTER TABLE [dbo].[DowntimeSegment]
    ADD CONSTRAINT [DowntimeSegment_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[DowntimeSegment]
    ADD CONSTRAINT [DowntimeSegment_workOrderId_fkey]
    FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[DowntimeSegment]
    ADD CONSTRAINT [DowntimeSegment_openedById_fkey]
    FOREIGN KEY ([openedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[DowntimeSegment]
    ADD CONSTRAINT [DowntimeSegment_closedById_fkey]
    FOREIGN KEY ([closedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.RcaCase', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[RcaCase] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NULL,
    [assetId] NVARCHAR(36) NULL,
    [vehicleId] NVARCHAR(36) NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [RcaCase_status_df] DEFAULT N'OPEN',
    [problemStatement] NVARCHAR(Max) NOT NULL,
    [evidenceJson] NVARCHAR(Max) NOT NULL CONSTRAINT [RcaCase_evidenceJson_df] DEFAULT N'[]',
    [fiveWhyJson] NVARCHAR(Max) NOT NULL CONSTRAINT [RcaCase_fiveWhyJson_df] DEFAULT N'[]',
    [failureCode] NVARCHAR(64) NULL,
    [causeCode] NVARCHAR(64) NULL,
    [rootCause] NVARCHAR(Max) NULL,
    [repeatCandidate] BIT NOT NULL CONSTRAINT [RcaCase_repeatCandidate_df] DEFAULT 0,
    [repeatWindowDays] INT NULL,
    [similarWoCount] INT NOT NULL CONSTRAINT [RcaCase_similarWoCount_df] DEFAULT 0,
    [ownerId] NVARCHAR(36) NULL,
    [completedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RcaCase_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RcaCase_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE INDEX [RcaCase_tenantId_status_idx] ON [dbo].[RcaCase]([tenantId],[status]);
  CREATE INDEX [RcaCase_tenantId_workOrderId_idx] ON [dbo].[RcaCase]([tenantId],[workOrderId]);
  CREATE INDEX [RcaCase_tenantId_assetId_createdAt_idx] ON [dbo].[RcaCase]([tenantId],[assetId],[createdAt]);
  CREATE INDEX [RcaCase_tenantId_repeatCandidate_idx] ON [dbo].[RcaCase]([tenantId],[repeatCandidate]);
  ALTER TABLE [dbo].[RcaCase]
    ADD CONSTRAINT [RcaCase_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[RcaCase]
    ADD CONSTRAINT [RcaCase_workOrderId_fkey]
    FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[RcaCase]
    ADD CONSTRAINT [RcaCase_ownerId_fkey]
    FOREIGN KEY ([ownerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.CapaAction', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[CapaAction] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [rcaCaseId] NVARCHAR(36) NOT NULL,
    [kind] NVARCHAR(16) NOT NULL,
    [description] NVARCHAR(Max) NOT NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [CapaAction_status_df] DEFAULT N'OPEN',
    [ownerId] NVARCHAR(36) NULL,
    [dueDate] DATETIME2 NULL,
    [verifiedAt] DATETIME2 NULL,
    [verificationNote] NVARCHAR(Max) NULL,
    [closedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CapaAction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CapaAction_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE INDEX [CapaAction_tenantId_rcaCaseId_idx] ON [dbo].[CapaAction]([tenantId],[rcaCaseId]);
  CREATE INDEX [CapaAction_tenantId_status_dueDate_idx] ON [dbo].[CapaAction]([tenantId],[status],[dueDate]);
  ALTER TABLE [dbo].[CapaAction]
    ADD CONSTRAINT [CapaAction_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[CapaAction]
    ADD CONSTRAINT [CapaAction_rcaCaseId_fkey]
    FOREIGN KEY ([rcaCaseId]) REFERENCES [dbo].[RcaCase]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[CapaAction]
    ADD CONSTRAINT [CapaAction_ownerId_fkey]
    FOREIGN KEY ([ownerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF OBJECT_ID(N'dbo.WorkPermit', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[WorkPermit] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [permitNumber] NVARCHAR(64) NOT NULL,
    [permitType] NVARCHAR(32) NOT NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [WorkPermit_status_df] DEFAULT N'DRAFT',
    [hazardsJson] NVARCHAR(Max) NOT NULL CONSTRAINT [WorkPermit_hazardsJson_df] DEFAULT N'[]',
    [ppeJson] NVARCHAR(Max) NOT NULL CONSTRAINT [WorkPermit_ppeJson_df] DEFAULT N'[]',
    [validFrom] DATETIME2 NULL,
    [validTo] DATETIME2 NULL,
    [issuedById] NVARCHAR(36) NULL,
    [approvedById] NVARCHAR(36) NULL,
    [notes] NVARCHAR(Max) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkPermit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkPermit_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkPermit_tenantId_permitNumber_key] UNIQUE NONCLUSTERED ([tenantId],[permitNumber])
  );
  CREATE INDEX [WorkPermit_tenantId_workOrderId_status_idx]
    ON [dbo].[WorkPermit]([tenantId],[workOrderId],[status]);
  CREATE INDEX [WorkPermit_tenantId_permitType_status_idx]
    ON [dbo].[WorkPermit]([tenantId],[permitType],[status]);
  CREATE INDEX [WorkPermit_tenantId_validTo_idx]
    ON [dbo].[WorkPermit]([tenantId],[validTo]);
  ALTER TABLE [dbo].[WorkPermit]
    ADD CONSTRAINT [WorkPermit_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[WorkPermit]
    ADD CONSTRAINT [WorkPermit_workOrderId_fkey]
    FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[WorkPermit]
    ADD CONSTRAINT [WorkPermit_issuedById_fkey]
    FOREIGN KEY ([issuedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[WorkPermit]
    ADD CONSTRAINT [WorkPermit_approvedById_fkey]
    FOREIGN KEY ([approvedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;
