-- Data fix (only rows where jobDomain IS NULL). Jobs created before the category existed, or by
-- accident / traffic-fine / follow-up shortcuts that did not stamp it, were missing from the
-- Machinery / Service / Vehicle Jobs pages. Same rule as resolveJobDomain without an explicit
-- category: vehicle -> VEHICLE, asset -> MACHINERY, otherwise (place / building) -> SERVICE.
EXEC(N'UPDATE [dbo].[WorkOrder]
SET [jobDomain] = CASE
    WHEN [vehicleId] IS NOT NULL THEN N''VEHICLE''
    WHEN [assetId] IS NOT NULL THEN N''MACHINERY''
    ELSE N''SERVICE''
  END
WHERE [jobDomain] IS NULL');
