-- One work order per PM occurrence. Null keys stay out of the index so ordinary work orders are unaffected.
IF EXISTS (
  SELECT tenantId, pmPlanId, pmOccurrenceKey
  FROM dbo.WorkOrder
  WHERE pmPlanId IS NOT NULL AND pmOccurrenceKey IS NOT NULL
  GROUP BY tenantId, pmPlanId, pmOccurrenceKey
  HAVING COUNT(*) > 1
)
  THROW 51000, N'Duplicate PM work orders exist. Resolve them before adding the occurrence uniqueness index.', 1;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'WorkOrder_pm_occurrence_key'
    AND object_id = OBJECT_ID(N'dbo.WorkOrder')
)
  CREATE UNIQUE NONCLUSTERED INDEX [WorkOrder_pm_occurrence_key]
    ON [dbo].[WorkOrder]([tenantId], [pmPlanId], [pmOccurrenceKey])
    WHERE [pmPlanId] IS NOT NULL AND [pmOccurrenceKey] IS NOT NULL;
