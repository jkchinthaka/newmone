-- Additive. Per-user session version embedded in access/refresh JWTs; bumping it revokes all issued tokens.
IF COL_LENGTH(N'dbo.User', N'sessionVersion') IS NULL
  ALTER TABLE [dbo].[User] ADD [sessionVersion] INT NOT NULL CONSTRAINT [User_sessionVersion_df] DEFAULT 0;
