-- DB-2: Work Order normalization extension tables (additive only).
-- Does NOT alter/drop WorkOrder columns or copy data.
-- Dual-write / backfill begin in DB-3 / DB-4.

BEGIN TRY
BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[WorkOrderPlanning] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [expectedCompletionDate] DATETIME2,
    [plannedStartAt] DATETIME2,
    [plannedEndAt] DATETIME2,
    [delayReason] NVARCHAR(1000),
    [cancelledReason] NVARCHAR(1000),
    [estimatedHours] FLOAT(53),
    [estimatedDurationMinutes] INT,
    [slaDeadline] DATETIME2,
    [slaBreached] BIT NOT NULL CONSTRAINT [WorkOrderPlanning_slaBreached_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderPlanning_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkOrderPlanning_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkOrderPlanning_workOrderId_key] UNIQUE NONCLUSTERED ([workOrderId])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderExecution] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [executionMode] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrderExecution_executionMode_df] DEFAULT '',
    [vendorSupplierId] NVARCHAR(36),
    [approvedById] NVARCHAR(36),
    [approvedAt] DATETIME2,
    [rejectionReason] NVARCHAR(1000),
    [startDate] DATETIME2,
    [failedAt] DATETIME2,
    [reportedAt] DATETIME2,
    [acknowledgedAt] DATETIME2,
    [technicianArrivedAt] DATETIME2,
    [repairStartedAt] DATETIME2,
    [repairCompletedAt] DATETIME2,
    [productionResumedAt] DATETIME2,
    [holdReasonCode] NVARCHAR(1000),
    [holdNotes] NVARCHAR(1000),
    [heldAt] DATETIME2,
    [expectedResumeAt] DATETIME2,
    [resumedAt] DATETIME2,
    [correctionReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderExecution_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkOrderExecution_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkOrderExecution_workOrderId_key] UNIQUE NONCLUSTERED ([workOrderId])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderCompletion] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [completedDate] DATETIME2,
    [technicianCompletionNote] NVARCHAR(1000),
    [verificationStatus] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrderCompletion_verificationStatus_df] DEFAULT '',
    [verifiedById] NVARCHAR(36),
    [verifiedAt] DATETIME2,
    [verificationNote] NVARCHAR(1000),
    [verificationRejectionReason] NVARCHAR(1000),
    [reopenReason] NVARCHAR(1000),
    [reopenedAt] DATETIME2,
    [reopenedById] NVARCHAR(36),
    [actualHours] FLOAT(53),
    [completionCondition] NVARCHAR(64),
    [followUpRequired] BIT NOT NULL CONSTRAINT [WorkOrderCompletion_followUpRequired_df] DEFAULT 0,
    [followUpNote] NVARCHAR(1000),
    [qrVerificationStatus] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrderCompletion_qrVerificationStatus_df] DEFAULT '',
    [qrVerifiedAt] DATETIME2,
    [qrVerifiedById] NVARCHAR(36),
    [qrVerifiedAssetId] NVARCHAR(36),
    [qrVerifiedVehicleId] NVARCHAR(36),
    [qrOverrideReason] NVARCHAR(1000),
    [requesterConfirmationStatus] NVARCHAR(64) NOT NULL CONSTRAINT [WorkOrderCompletion_requesterConfirmationStatus_df] DEFAULT 'NOT_REQUIRED',
    [requesterConfirmationDueAt] DATETIME2,
    [requesterConfirmedAt] DATETIME2,
    [requesterConfirmedById] NVARCHAR(36),
    [requesterConfirmationNote] NVARCHAR(1000),
    [requesterConfirmationOutcome] NVARCHAR(64),
    [requesterConfirmationPolicyHours] INT,
    [functionalTestResult] NVARCHAR(32),
    [roadTestResult] NVARCHAR(32),
    [completionMeterReading] FLOAT(53),
    [operatingRestriction] NVARCHAR(max),
    [productionImpact] NVARCHAR(32),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderCompletion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkOrderCompletion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkOrderCompletion_workOrderId_key] UNIQUE NONCLUSTERED ([workOrderId])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderSafety] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [riskLevel] NVARCHAR(1000),
    [ppeRequired] NVARCHAR(max) NOT NULL CONSTRAINT [WorkOrderSafety_ppeRequired_df] DEFAULT '[]',
    [lotoRequired] BIT NOT NULL CONSTRAINT [WorkOrderSafety_lotoRequired_df] DEFAULT 0,
    [hotWorkRequired] BIT NOT NULL CONSTRAINT [WorkOrderSafety_hotWorkRequired_df] DEFAULT 0,
    [workingAtHeight] BIT NOT NULL CONSTRAINT [WorkOrderSafety_workingAtHeight_df] DEFAULT 0,
    [electricalIsolation] BIT NOT NULL CONSTRAINT [WorkOrderSafety_electricalIsolation_df] DEFAULT 0,
    [confinedSpace] BIT NOT NULL CONSTRAINT [WorkOrderSafety_confinedSpace_df] DEFAULT 0,
    [permitReference] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderSafety_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkOrderSafety_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkOrderSafety_workOrderId_key] UNIQUE NONCLUSTERED ([workOrderId])
);

-- CreateTable
CREATE TABLE [dbo].[WorkOrderClassification] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [workOrderId] NVARCHAR(36) NOT NULL,
    [maintenanceTemplateId] NVARCHAR(36),
    [maintenanceTemplateVersion] INT,
    [maintenanceTemplateSnapshot] NVARCHAR(max),
    [failureCodeId] NVARCHAR(36),
    [causeCodeId] NVARCHAR(36),
    [remedyCodeId] NVARCHAR(36),
    [failureCodeSnapshot] NVARCHAR(1000),
    [causeCodeSnapshot] NVARCHAR(1000),
    [remedyCodeSnapshot] NVARCHAR(1000),
    [taxonomyCategoryId] NVARCHAR(36),
    [taxonomyTypeId] NVARCHAR(36),
    [taxonomyIssueId] NVARCHAR(36),
    [categoryNameSnapshot] NVARCHAR(1000),
    [typeNameSnapshot] NVARCHAR(1000),
    [issueNameSnapshot] NVARCHAR(1000),
    [isTriage] BIT NOT NULL CONSTRAINT [WorkOrderClassification_isTriage_df] DEFAULT 0,
    [triageReason] NVARCHAR(1000),
    [triageClassifiedAt] DATETIME2,
    [triageClassifiedById] NVARCHAR(36),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkOrderClassification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkOrderClassification_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkOrderClassification_workOrderId_key] UNIQUE NONCLUSTERED ([workOrderId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkOrderPlanning_tenantId_idx] ON [dbo].[WorkOrderPlanning]([tenantId]);
CREATE NONCLUSTERED INDEX [WorkOrderPlanning_tenantId_plannedEndAt_idx] ON [dbo].[WorkOrderPlanning]([tenantId], [plannedEndAt]);

CREATE NONCLUSTERED INDEX [WorkOrderExecution_tenantId_idx] ON [dbo].[WorkOrderExecution]([tenantId]);
CREATE NONCLUSTERED INDEX [WorkOrderExecution_tenantId_vendorSupplierId_idx] ON [dbo].[WorkOrderExecution]([tenantId], [vendorSupplierId]);

CREATE NONCLUSTERED INDEX [WorkOrderCompletion_tenantId_idx] ON [dbo].[WorkOrderCompletion]([tenantId]);
CREATE NONCLUSTERED INDEX [WorkOrderCompletion_tenantId_verificationStatus_idx] ON [dbo].[WorkOrderCompletion]([tenantId], [verificationStatus]);

CREATE NONCLUSTERED INDEX [WorkOrderSafety_tenantId_idx] ON [dbo].[WorkOrderSafety]([tenantId]);

CREATE NONCLUSTERED INDEX [WorkOrderClassification_tenantId_idx] ON [dbo].[WorkOrderClassification]([tenantId]);
CREATE NONCLUSTERED INDEX [WorkOrderClassification_tenantId_isTriage_idx] ON [dbo].[WorkOrderClassification]([tenantId], [isTriage]);
CREATE NONCLUSTERED INDEX [WorkOrderClassification_tenantId_maintenanceTemplateId_idx] ON [dbo].[WorkOrderClassification]([tenantId], [maintenanceTemplateId]);

-- AddForeignKey
ALTER TABLE [dbo].[WorkOrderPlanning] ADD CONSTRAINT [WorkOrderPlanning_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderPlanning] ADD CONSTRAINT [WorkOrderPlanning_workOrderId_fkey]
  FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[WorkOrderExecution] ADD CONSTRAINT [WorkOrderExecution_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderExecution] ADD CONSTRAINT [WorkOrderExecution_workOrderId_fkey]
  FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderExecution] ADD CONSTRAINT [WorkOrderExecution_vendorSupplierId_fkey]
  FOREIGN KEY ([vendorSupplierId]) REFERENCES [dbo].[Supplier]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderExecution] ADD CONSTRAINT [WorkOrderExecution_approvedById_fkey]
  FOREIGN KEY ([approvedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[WorkOrderCompletion] ADD CONSTRAINT [WorkOrderCompletion_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderCompletion] ADD CONSTRAINT [WorkOrderCompletion_workOrderId_fkey]
  FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderCompletion] ADD CONSTRAINT [WorkOrderCompletion_verifiedById_fkey]
  FOREIGN KEY ([verifiedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderCompletion] ADD CONSTRAINT [WorkOrderCompletion_reopenedById_fkey]
  FOREIGN KEY ([reopenedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderCompletion] ADD CONSTRAINT [WorkOrderCompletion_qrVerifiedById_fkey]
  FOREIGN KEY ([qrVerifiedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderCompletion] ADD CONSTRAINT [WorkOrderCompletion_requesterConfirmedById_fkey]
  FOREIGN KEY ([requesterConfirmedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[WorkOrderSafety] ADD CONSTRAINT [WorkOrderSafety_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderSafety] ADD CONSTRAINT [WorkOrderSafety_workOrderId_fkey]
  FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[WorkOrderClassification] ADD CONSTRAINT [WorkOrderClassification_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderClassification] ADD CONSTRAINT [WorkOrderClassification_workOrderId_fkey]
  FOREIGN KEY ([workOrderId]) REFERENCES [dbo].[WorkOrder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderClassification] ADD CONSTRAINT [WorkOrderClassification_maintenanceTemplateId_fkey]
  FOREIGN KEY ([maintenanceTemplateId]) REFERENCES [dbo].[MaintenanceTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderClassification] ADD CONSTRAINT [WorkOrderClassification_failureCodeId_fkey]
  FOREIGN KEY ([failureCodeId]) REFERENCES [dbo].[MaintenanceAnalysisCode]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderClassification] ADD CONSTRAINT [WorkOrderClassification_causeCodeId_fkey]
  FOREIGN KEY ([causeCodeId]) REFERENCES [dbo].[MaintenanceAnalysisCode]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderClassification] ADD CONSTRAINT [WorkOrderClassification_remedyCodeId_fkey]
  FOREIGN KEY ([remedyCodeId]) REFERENCES [dbo].[MaintenanceAnalysisCode]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderClassification] ADD CONSTRAINT [WorkOrderClassification_taxonomyCategoryId_fkey]
  FOREIGN KEY ([taxonomyCategoryId]) REFERENCES [dbo].[WorkOrderTaxonomy]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderClassification] ADD CONSTRAINT [WorkOrderClassification_taxonomyTypeId_fkey]
  FOREIGN KEY ([taxonomyTypeId]) REFERENCES [dbo].[WorkOrderTaxonomy]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderClassification] ADD CONSTRAINT [WorkOrderClassification_taxonomyIssueId_fkey]
  FOREIGN KEY ([taxonomyIssueId]) REFERENCES [dbo].[WorkOrderTaxonomy]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[WorkOrderClassification] ADD CONSTRAINT [WorkOrderClassification_triageClassifiedById_fkey]
  FOREIGN KEY ([triageClassifiedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
