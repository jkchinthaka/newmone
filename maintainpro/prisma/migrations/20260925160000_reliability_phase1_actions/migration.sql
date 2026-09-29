-- Additive reliability Phase 1 fields. Existing policy, RCA, and CAPA rows are kept.

BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[ReliabilityPolicy] ADD [repeatAction] NVARCHAR(32) NOT NULL CONSTRAINT [ReliabilityPolicy_repeatAction_df] DEFAULT 'FLAG_ONLY';

EXEC(N'UPDATE [dbo].[ReliabilityPolicy] SET [repeatAction] = ''REQUIRE_RCA'' WHERE [requireRcaOnRepeat] = 1');

ALTER TABLE [dbo].[RcaCase] ADD [dueDate] DATETIME2 NULL;
ALTER TABLE [dbo].[RcaCase] ADD [clusterKey] NVARCHAR(160) NULL;
ALTER TABLE [dbo].[RcaCase] ADD [source] NVARCHAR(32) NULL;
ALTER TABLE [dbo].[RcaCase] ADD [impact] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[RcaCase] ADD [method] NVARCHAR(32) NULL;
ALTER TABLE [dbo].[RcaCase] ADD [effectiveness] NVARCHAR(32) NULL;
ALTER TABLE [dbo].[RcaCase] ADD [effectivenessNote] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[RcaCase] ADD [effectivenessVerifiedById] NVARCHAR(36) NULL;
ALTER TABLE [dbo].[RcaCase] ADD [effectivenessVerifiedAt] DATETIME2 NULL;

CREATE NONCLUSTERED INDEX [RcaCase_tenantId_clusterKey_status_idx]
  ON [dbo].[RcaCase]([tenantId], [clusterKey], [status]);

ALTER TABLE [dbo].[CapaAction] ADD [evidenceJson] NVARCHAR(MAX) NOT NULL CONSTRAINT [CapaAction_evidenceJson_df] DEFAULT '[]';
ALTER TABLE [dbo].[CapaAction] ADD [verifiedById] NVARCHAR(36) NULL;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
