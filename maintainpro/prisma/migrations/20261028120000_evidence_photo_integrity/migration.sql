-- Additive. Live-photo integrity for evidence: content hash (duplicate photo check) and optional capture location.
IF COL_LENGTH(N'dbo.EvidenceAttachment', N'contentSha256') IS NULL
  ALTER TABLE [dbo].[EvidenceAttachment] ADD [contentSha256] NVARCHAR(64) NULL;
IF COL_LENGTH(N'dbo.EvidenceAttachment', N'captureLatitude') IS NULL
  ALTER TABLE [dbo].[EvidenceAttachment] ADD [captureLatitude] FLOAT NULL;
IF COL_LENGTH(N'dbo.EvidenceAttachment', N'captureLongitude') IS NULL
  ALTER TABLE [dbo].[EvidenceAttachment] ADD [captureLongitude] FLOAT NULL;
IF COL_LENGTH(N'dbo.EvidenceAttachment', N'captureAccuracyMeters') IS NULL
  ALTER TABLE [dbo].[EvidenceAttachment] ADD [captureAccuracyMeters] FLOAT NULL;

-- Dynamic SQL so the batch compiles before contentSha256 exists.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'EvidenceAttachment_tenantId_contentSha256_idx' AND object_id = OBJECT_ID(N'dbo.EvidenceAttachment')
)
  EXEC(N'CREATE NONCLUSTERED INDEX [EvidenceAttachment_tenantId_contentSha256_idx] ON [dbo].[EvidenceAttachment]([tenantId], [contentSha256])');
