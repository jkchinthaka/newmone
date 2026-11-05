-- Approval rules can be scoped to a requester group. Additive, nullable.
IF COL_LENGTH('dbo.ApprovalRule', 'requesterGroupId') IS NULL
  ALTER TABLE [dbo].[ApprovalRule] ADD [requesterGroupId] NVARCHAR(36) NULL;
