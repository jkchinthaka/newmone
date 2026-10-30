-- Site GPS centre and radius for the "job photo taken far from the site" fraud check. Additive, nullable.
IF COL_LENGTH(N'dbo.Site', N'latitude') IS NULL
  ALTER TABLE [dbo].[Site] ADD [latitude] FLOAT NULL;
IF COL_LENGTH(N'dbo.Site', N'longitude') IS NULL
  ALTER TABLE [dbo].[Site] ADD [longitude] FLOAT NULL;
IF COL_LENGTH(N'dbo.Site', N'geoRadiusMeters') IS NULL
  ALTER TABLE [dbo].[Site] ADD [geoRadiusMeters] INT NULL;
