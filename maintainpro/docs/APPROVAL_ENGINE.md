# Approval Engine

Central approval rules live under `apps/api/src/modules/approvals`.

## Capabilities

- Transaction-type rules with levels (`ApprovalRule` / `ApprovalRuleLevel`)
- Cost / criticality / priority thresholds (configured, not hard-coded in WO service)
- Sequential multi-level approval
- Emergency override permission (`approvals.override.emergency`)
- **Delegation** via `ApprovalDelegation` (`POST /approval-delegations`) — resolvable with `resolveDelegatedApprovers`
- Policy version retained on transactions where approval snapshot fields exist

## Modes supported in model/engine

| Mode | Support |
|------|---------|
| Sequential | Yes |
| Threshold | Yes (rule config) |
| Delegation | Yes (API + resolver) |
| Send-back / reject | Yes (approval decisions) |
| Parallel / any-one | Via rule level configuration |

## SoD

Self-approval blocked by `EnterpriseGovernanceService.assertSoD("APPROVAL", …)` defaults and configurable `SoDPolicy` rows.
