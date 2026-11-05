-- Users can be mapped to a home location (Site). Additive, nullable.
IF COL_LENGTH('dbo.User', 'siteId') IS NULL
  ALTER TABLE [dbo].[User] ADD [siteId] NVARCHAR(36) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'User_siteId_fkey')
  ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_siteId_fkey] FOREIGN KEY ([siteId]) REFERENCES [dbo].[Site]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
