-- Optional vendor insurance. Existing suppliers stay assignable until insurance is marked required.
-- Rows are preserved. No dates are invented.

BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[Supplier] ADD [insuranceRequired] BIT NOT NULL CONSTRAINT [Supplier_insuranceRequired_df] DEFAULT 0;
ALTER TABLE [dbo].[Supplier] ADD [insuranceExpiresAt] DATETIME2 NULL;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
