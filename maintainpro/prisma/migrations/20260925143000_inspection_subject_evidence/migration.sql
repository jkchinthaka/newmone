-- Additive inspection subject and evidence linkage.
-- Existing Inspection and EvidenceAttachment rows are preserved.

BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[Inspection] ADD [functionalLocationId] NVARCHAR(36) NULL;
ALTER TABLE [dbo].[Inspection] ADD [inspectionType] NVARCHAR(64) NULL;
ALTER TABLE [dbo].[Inspection] ADD [description] NVARCHAR(2000) NULL;

ALTER TABLE [dbo].[EvidenceAttachment] ADD [inspectionId] NVARCHAR(36) NULL;
ALTER TABLE [dbo].[EvidenceAttachment] ADD [checklistItemKey] NVARCHAR(64) NULL;

ALTER TABLE [dbo].[Inspection] ADD CONSTRAINT [Inspection_functionalLocationId_fkey]
  FOREIGN KEY ([functionalLocationId]) REFERENCES [dbo].[FunctionalLocation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[EvidenceAttachment] ADD CONSTRAINT [EvidenceAttachment_inspectionId_fkey]
  FOREIGN KEY ([inspectionId]) REFERENCES [dbo].[Inspection]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [Inspection_functionalLocationId_idx] ON [dbo].[Inspection]([functionalLocationId]);
CREATE NONCLUSTERED INDEX [EvidenceAttachment_tenantId_inspectionId_checklistItemKey_idx]
  ON [dbo].[EvidenceAttachment]([tenantId], [inspectionId], [checklistItemKey]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
