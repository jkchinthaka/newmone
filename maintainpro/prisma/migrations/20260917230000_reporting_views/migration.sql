-- Governed Power BI / reporting read models (tenant-safe views)

IF OBJECT_ID(N'dbo.vw_rpt_fact_maintenance', N'V') IS NOT NULL
  EXEC(N'DROP VIEW [dbo].[vw_rpt_fact_maintenance]');
IF OBJECT_ID(N'dbo.vw_rpt_fact_downtime', N'V') IS NOT NULL
  EXEC(N'DROP VIEW [dbo].[vw_rpt_fact_downtime]');
IF OBJECT_ID(N'dbo.vw_rpt_dim_branch_site', N'V') IS NOT NULL
  EXEC(N'DROP VIEW [dbo].[vw_rpt_dim_branch_site]');
IF OBJECT_ID(N'dbo.vw_rpt_dim_date', N'V') IS NOT NULL
  EXEC(N'DROP VIEW [dbo].[vw_rpt_dim_date]');

EXEC(N'
CREATE VIEW [dbo].[vw_rpt_dim_date] AS
SELECT DISTINCT
  CAST(createdAt AS DATE) AS [dateKey],
  YEAR(createdAt) AS [year],
  MONTH(createdAt) AS [month],
  DAY(createdAt) AS [day]
FROM [dbo].[WorkOrder]
WHERE createdAt IS NOT NULL
');

EXEC(N'
CREATE VIEW [dbo].[vw_rpt_dim_branch_site] AS
SELECT
  s.[id] AS siteId,
  s.[tenantId],
  s.[code] AS siteCode,
  s.[name] AS siteName
FROM [dbo].[Site] s
');

EXEC(N'
CREATE VIEW [dbo].[vw_rpt_fact_maintenance] AS
SELECT
  w.[id] AS workOrderId,
  w.[tenantId],
  w.[woNumber],
  w.[status],
  w.[priority],
  w.[type],
  w.[jobDomain],
  w.[assetId],
  w.[vehicleId],
  w.[siteId],
  w.[createdAt],
  w.[completedDate] AS [completedAt],
  w.[actualCost],
  w.[actualHours],
  w.[repeatFailureCandidate]
FROM [dbo].[WorkOrder] w
');

EXEC(N'
CREATE VIEW [dbo].[vw_rpt_fact_downtime] AS
SELECT
  d.[id] AS segmentId,
  d.[tenantId],
  d.[workOrderId],
  d.[assetId],
  d.[category],
  d.[planned],
  d.[startedAt],
  d.[endedAt],
  d.[productionAffected],
  d.[estimatedLostHours]
FROM [dbo].[DowntimeSegment] d
');
