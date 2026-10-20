-- One reading per meter at a given timestamp. MeterReading has no tenantId;
-- meterId belongs to exactly one UtilityMeter, and UtilityMeter is unique per tenant,
-- so this constraint is tenant-scoped through the meter.
IF EXISTS (
  SELECT meterId, readingDate
  FROM dbo.MeterReading
  GROUP BY meterId, readingDate
  HAVING COUNT(*) > 1
)
  THROW 51000, N'Duplicate meter readings exist for the same meter and timestamp. Resolve them before adding the uniqueness index.', 1;

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'MeterReading_meterId_readingDate_idx'
    AND object_id = OBJECT_ID(N'dbo.MeterReading')
)
  DROP INDEX [MeterReading_meterId_readingDate_idx] ON [dbo].[MeterReading];

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'MeterReading_meterId_readingDate_key'
    AND object_id = OBJECT_ID(N'dbo.MeterReading')
)
  CREATE UNIQUE NONCLUSTERED INDEX [MeterReading_meterId_readingDate_key]
    ON [dbo].[MeterReading]([meterId], [readingDate]);
