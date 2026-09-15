# Phase 7 — Configurable Approval & Control Engine

**Branch:** `maintainpro/phase-07-approval-engine`  
**Baseline:** `maintainpro/phase-06-work-orders` @ `bb48180af64f9d5bae066f9c6428911450989585`  
**Date:** 2026-09-15

## Objective

One reusable Approval Engine for controlled maintenance processes. Domain modules call the engine; they do not embed separate approval workflows.

## Existing approvals audited

| System | Disposition |
|--------|-------------|
| `WorkOrder.approvalStatus` + approve/reject endpoints | **INTEGRATE** — synced when engine rules require approval; legacy fields retained |
| Phase 6 `workOrderApprovalExtensionPoint` | **INTEGRATE** — call sites use `ApprovalsService.ensureApprovalRequired` |
| `PartRequestApproval` | **KEEP SEPARATE** — procurement operational/finance stages |
| `PurchaseOrderApproval` | **KEEP SEPARATE** — purchasing domain |
| Vendor repair `VendorApprovalLevel` helpers | **INTEGRATE later** via `VENDOR_REPAIR` process type (engine wired on WO start for vendor/external types) |
| Asset retirement technical checks | **REUSE** — always run before approval; approval never bypasses integrity |
| Gate override concepts | **HOOK ONLY** — `GATE_OVERRIDE` + `/approvals/hooks/gate-override` for Phase 10 |
| Notifications / AuditLog | **REUSE** |

## Architecture

### ApprovalRule
Versioned, tenant-scoped. Edits **deactivate** prior version and create `version+1` under the same `ruleFamilyKey`. Historical requests keep `triggeredRuleId` + `triggeredRuleVersion` + immutable `ruleSnapshot`.

### ApprovalRequest
Subject entity + process type + snapshot. Status: PENDING | APPROVED | REJECTED | CANCELLED | EMERGENCY_OVERRIDE_PENDING_REVIEW.

### ApprovalStep
Multi-level chain with assigned/backup approver, dueAt, escalation state.

### ApprovalDecision
Immutable APPROVED/REJECTED records. Rejection **requires** reason.

### Conditions
Structured only (`field` / `operator` / `value`). No executable JS/SQL.

### Approver resolution
Specific user → else first active user with role in tenant. **Missing approver = config error (never auto-approve).**

## Process types

CRITICAL_WORK_ORDER, HIGH_COST_WORK_ORDER, VENDOR_REPAIR, ASSET_RETIREMENT, WORK_ORDER_REOPEN, CLOSED_RECORD_CORRECTION, GATE_OVERRIDE, COMPLIANCE_EXCEPTION, BUDGET_EXCEPTION.

Thresholds are rule fields — **no hardcoded company amounts**.

## Work Order integration

- Create-time: CRITICAL / HIGH_COST / VENDOR_REPAIR rules may open requests and set `approvalStatus=PENDING`.
- Start (`IN_PROGRESS`): engine re-checked; blocked until approved unless emergency override pending review allows proceed.
- Reopen from CLOSED/COMPLETED/CANCELLED/VERIFIED: when a rule matches, reopen is **deferred** until approval (`APPROVAL_REQUIRED`). Side-effect on final approve performs reopen.
- Cancelled WO cannot casually return to IN_PROGRESS without authority + reason + optional approval.

## Asset retirement

Technical validation (open WO, active children) → Approval if required → Retire. Approval success does not skip technical checks.

## Emergency override

Allowed only when rule `emergencyOverrideAllowed`. Sets `EMERGENCY_OVERRIDE_PENDING_REVIEW` with mandatory reason + audit. Does **not** erase the original requirement (post-review remains).

## Admin / Inbox

- `/admin/approvals` — rule list, create, deactivate, preview, simulate
- `/approvals` + `/approvals/[id]` — responsive inbox and detail

## Permissions

`approvals.view`, `approvals.view_all`, `approvals.decide`, `approvals.rule.manage`, `approvals.override.emergency` (with manage aliases during rollout).

## Phase 8 readiness note

Phase 8 must start from this branch’s final remote tip on a new integration line when readiness = YES. Do not merge historical Phase 8–14 branches.
