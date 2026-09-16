-- Phase 15 follow-up: SQL Server compatibility fixes discovered during live SQL Server
-- validation (not caught earlier because no prior session had a reachable SQL Server
-- instance — see docs/V1_FINAL_VALIDATION_GATE_STATUS.md Gate 1).
--
-- 1) Vehicle.assetId / Vehicle.vin were created by the init migration as plain SQL Server
--    UNIQUE constraints on nullable columns. Unlike Postgres/MongoDB, SQL Server treats NULL
--    as a normal value for uniqueness purposes, so a plain UNIQUE constraint allows at most
--    ONE NULL row total. Seeding a second vehicle with no linked Asset (assetId = NULL) or no
--    VIN on record (vin = NULL) fails. Prisma 5 has no schema syntax for a filtered/partial
--    unique index (see https://github.com/prisma/prisma/issues/3387), so this is fixed here
--    with a hand-written migration: drop the plain constraints, recreate as unique filtered
--    nonclustered indexes that only apply `WHERE <col> IS NOT NULL`.
--
-- 2) Vehicle.registrationNo / Vehicle.vin / Vehicle.assetTag were unbounded NVARCHAR(1000)
--    (Prisma's SQL Server default for `String` with no @db.NVarChar length). At 2 bytes/char
--    that's 2000 bytes, which exceeds SQL Server's 1700-byte nonclustered index key limit
--    (the "Vehicle_vin_key" index-create warning already observed). Real-world VINs are
--    bounded (17 chars per ISO 3779); plate numbers and internal asset tags are similarly
--    bounded. Columns are narrowed to domain-appropriate, safely-under-the-limit lengths.
--
-- 3) Asset.qrCodeUrl and four other *.qrCodeUrl columns store base64 data-URI PNGs generated
--    by QrCodeService.toDataUrl() — routinely several KB, but the columns were left at the
--    unbounded-String SQL Server default of NVARCHAR(1000), so QR generation failed at insert
--    time with "The provided value for the column is too long for the column's type." These
--    are not indexed, so NVARCHAR(MAX) (matching the original unbounded Mongo string) is safe.
--
-- This script is written defensively (IF EXISTS guards) rather than as straight-line DDL:
-- this repo's local dev database already had the assetId/vin filtered-index half of this fix
-- applied by hand (see PROJECT PROMPT / V1_FINAL_VALIDATION_GATE_STATUS.md), so the same
-- migration file has to succeed both against a genuinely fresh database (where the init
-- migration's plain constraints still exist) and against this already-hand-patched one
-- (where they were already replaced with indexes) without an operator manually diverging
-- again. Do not simplify this back to unconditional DROP CONSTRAINT / CREATE INDEX pairs.

-- ===== Vehicle.registrationNo_key: drop whichever form currently exists =====
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'Vehicle_registrationNo_key' AND parent_object_id = OBJECT_ID('dbo.Vehicle'))
  ALTER TABLE [dbo].[Vehicle] DROP CONSTRAINT [Vehicle_registrationNo_key];
ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'Vehicle_registrationNo_key' AND object_id = OBJECT_ID('dbo.Vehicle'))
  DROP INDEX [Vehicle_registrationNo_key] ON [dbo].[Vehicle];

-- ===== Vehicle.assetId_key: drop whichever form currently exists =====
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'Vehicle_assetId_key' AND parent_object_id = OBJECT_ID('dbo.Vehicle'))
  ALTER TABLE [dbo].[Vehicle] DROP CONSTRAINT [Vehicle_assetId_key];
ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'Vehicle_assetId_key' AND object_id = OBJECT_ID('dbo.Vehicle'))
  DROP INDEX [Vehicle_assetId_key] ON [dbo].[Vehicle];

-- ===== Vehicle.vin_key: drop whichever form currently exists =====
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'Vehicle_vin_key' AND parent_object_id = OBJECT_ID('dbo.Vehicle'))
  ALTER TABLE [dbo].[Vehicle] DROP CONSTRAINT [Vehicle_vin_key];
ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'Vehicle_vin_key' AND object_id = OBJECT_ID('dbo.Vehicle'))
  DROP INDEX [Vehicle_vin_key] ON [dbo].[Vehicle];

-- ===== Vehicle.assetTag_idx =====
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'Vehicle_assetTag_idx' AND object_id = OBJECT_ID('dbo.Vehicle'))
  DROP INDEX [Vehicle_assetTag_idx] ON [dbo].[Vehicle];

-- ===== Vehicle: narrow oversized indexed string columns =====
ALTER TABLE [dbo].[Vehicle] ALTER COLUMN [registrationNo] NVARCHAR(64) NOT NULL;
ALTER TABLE [dbo].[Vehicle] ALTER COLUMN [vin] NVARCHAR(32) NULL;
ALTER TABLE [dbo].[Vehicle] ALTER COLUMN [assetTag] NVARCHAR(64) NULL;

-- ===== Vehicle: recreate registrationNo as a normal (NOT NULL) unique constraint =====
ALTER TABLE [dbo].[Vehicle] ADD CONSTRAINT [Vehicle_registrationNo_key] UNIQUE NONCLUSTERED ([registrationNo]);

-- ===== Vehicle: recreate assetId/vin uniqueness as filtered indexes (NULLs excluded) =====
CREATE UNIQUE NONCLUSTERED INDEX [Vehicle_assetId_key] ON [dbo].[Vehicle]([assetId]) WHERE [assetId] IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX [Vehicle_vin_key] ON [dbo].[Vehicle]([vin]) WHERE [vin] IS NOT NULL;

-- ===== Vehicle: recreate the plain (non-unique) assetTag index =====
CREATE NONCLUSTERED INDEX [Vehicle_assetTag_idx] ON [dbo].[Vehicle]([assetTag]);

-- ===== qrCodeUrl: widen unbounded base64 data-URI columns to NVARCHAR(MAX) =====
ALTER TABLE [dbo].[Asset] ALTER COLUMN [qrCodeUrl] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[CleaningLocation] ALTER COLUMN [qrCodeUrl] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[LivestockAnimal] ALTER COLUMN [qrCodeUrl] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[FarmWorker] ALTER COLUMN [qrCodeUrl] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[TraceabilityRecord] ALTER COLUMN [qrCodeUrl] NVARCHAR(MAX) NULL;
