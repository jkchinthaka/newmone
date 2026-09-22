-- D2 Work Order Core: requester confirmation + labour correction fields

ALTER TABLE [dbo].[WorkOrder] ADD [requesterConfirmationStatus] NVARCHAR(64) NOT NULL CONSTRAINT [DF_WorkOrder_requesterConfirmationStatus] DEFAULT N'NOT_REQUIRED';
ALTER TABLE [dbo].[WorkOrder] ADD [requesterConfirmationDueAt] DATETIME2 NULL;
ALTER TABLE [dbo].[WorkOrder] ADD [requesterConfirmedAt] DATETIME2 NULL;
ALTER TABLE [dbo].[WorkOrder] ADD [requesterConfirmedById] NVARCHAR(36) NULL;
ALTER TABLE [dbo].[WorkOrder] ADD [requesterConfirmationNote] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[WorkOrder] ADD [requesterConfirmationOutcome] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[WorkOrder] ADD [requesterConfirmationPolicyHours] INT NULL;

ALTER TABLE [dbo].[WorkOrderLabourEntry] ADD [correctionReason] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[WorkOrderLabourEntry] ADD [correctedDurationMinutes] INT NULL;
ALTER TABLE [dbo].[WorkOrderLabourEntry] ADD [correctedById] NVARCHAR(36) NULL;
ALTER TABLE [dbo].[WorkOrderLabourEntry] ADD [correctionApprovedById] NVARCHAR(36) NULL;
ALTER TABLE [dbo].[WorkOrderLabourEntry] ADD [correctedAt] DATETIME2 NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'WorkOrderLabourEntry_technicianUserId_endedAt_idx'
    AND object_id = OBJECT_ID(N'dbo.WorkOrderLabourEntry')
)
  CREATE NONCLUSTERED INDEX [WorkOrderLabourEntry_technicianUserId_endedAt_idx]
    ON [dbo].[WorkOrderLabourEntry]([technicianUserId], [endedAt]);
