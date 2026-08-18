import {
  AccidentStatus,
  AssetStatus,
  ErpReconciliationMismatchStatus,
  FinePaymentStatus,
  InsuranceClaimStatus,
  PartRequestStatus,
  POStatus,
  PurchaseOrderWorkflowStatus,
  WorkOrderStatus
} from "@prisma/client";

import { ALLOWED_STATUS_TRANSITIONS } from "../../common/utils/work-order-governance";
import { allow, deny, type PolicyDecision } from "./policy-decision";

export type StateMachineName =
  | "WORK_ORDER"
  | "PURCHASE_ORDER"
  | "PURCHASE_ORDER_WORKFLOW"
  | "PART_REQUEST"
  | "RECONCILIATION"
  | "ACCIDENT"
  | "INSURANCE_CLAIM"
  | "TRAFFIC_FINE"
  | "ASSET";

const MACHINES: Record<StateMachineName, Record<string, string[]>> = {
  WORK_ORDER: Object.fromEntries(
    Object.entries(ALLOWED_STATUS_TRANSITIONS).map(([from, to]) => [from, [...to]])
  ),
  PURCHASE_ORDER: {
    [POStatus.PENDING]: [POStatus.ORDERED, POStatus.CANCELLED],
    [POStatus.ORDERED]: [POStatus.PARTIALLY_RECEIVED, POStatus.RECEIVED, POStatus.CANCELLED],
    [POStatus.PARTIALLY_RECEIVED]: [POStatus.RECEIVED, POStatus.CANCELLED],
    [POStatus.RECEIVED]: [],
    [POStatus.CANCELLED]: []
  },
  PURCHASE_ORDER_WORKFLOW: {
    [PurchaseOrderWorkflowStatus.PENDING_OPERATIONAL]: [
      PurchaseOrderWorkflowStatus.PENDING_FINANCE,
      PurchaseOrderWorkflowStatus.APPROVED,
      PurchaseOrderWorkflowStatus.REJECTED
    ],
    [PurchaseOrderWorkflowStatus.PENDING_FINANCE]: [
      PurchaseOrderWorkflowStatus.APPROVED,
      PurchaseOrderWorkflowStatus.REJECTED
    ],
    [PurchaseOrderWorkflowStatus.APPROVED]: [],
    [PurchaseOrderWorkflowStatus.REJECTED]: []
  },
  PART_REQUEST: {
    [PartRequestStatus.PENDING_OPERATIONAL]: [
      PartRequestStatus.PENDING_FINANCE,
      PartRequestStatus.APPROVED,
      PartRequestStatus.REJECTED,
      PartRequestStatus.CANCELLED
    ],
    [PartRequestStatus.PENDING_FINANCE]: [
      PartRequestStatus.APPROVED,
      PartRequestStatus.REJECTED,
      PartRequestStatus.CANCELLED
    ],
    [PartRequestStatus.APPROVED]: [
      PartRequestStatus.PARTIALLY_ISSUED,
      PartRequestStatus.ISSUED,
      PartRequestStatus.CANCELLED
    ],
    [PartRequestStatus.PARTIALLY_ISSUED]: [PartRequestStatus.ISSUED, PartRequestStatus.CANCELLED],
    [PartRequestStatus.ISSUED]: [],
    [PartRequestStatus.REJECTED]: [],
    [PartRequestStatus.CANCELLED]: []
  },
  RECONCILIATION: {
    [ErpReconciliationMismatchStatus.OPEN]: [ErpReconciliationMismatchStatus.REVIEWED],
    [ErpReconciliationMismatchStatus.REVIEWED]: [
      ErpReconciliationMismatchStatus.ACCEPTED,
      ErpReconciliationMismatchStatus.CORRECTED,
      ErpReconciliationMismatchStatus.IGNORED
    ],
    [ErpReconciliationMismatchStatus.ACCEPTED]: [],
    [ErpReconciliationMismatchStatus.CORRECTED]: [],
    [ErpReconciliationMismatchStatus.IGNORED]: []
  },
  ACCIDENT: {
    [AccidentStatus.REPORTED]: [AccidentStatus.UNDER_INVESTIGATION, AccidentStatus.CLOSED],
    [AccidentStatus.UNDER_INVESTIGATION]: [AccidentStatus.CLOSED],
    [AccidentStatus.CLOSED]: []
  },
  INSURANCE_CLAIM: {
    [InsuranceClaimStatus.DRAFT]: [InsuranceClaimStatus.FILED, InsuranceClaimStatus.CLOSED],
    [InsuranceClaimStatus.FILED]: [InsuranceClaimStatus.UNDER_REVIEW, InsuranceClaimStatus.REJECTED, InsuranceClaimStatus.CLOSED],
    [InsuranceClaimStatus.UNDER_REVIEW]: [
      InsuranceClaimStatus.APPROVED,
      InsuranceClaimStatus.REJECTED,
      InsuranceClaimStatus.CLOSED
    ],
    [InsuranceClaimStatus.APPROVED]: [InsuranceClaimStatus.SETTLED, InsuranceClaimStatus.CLOSED],
    [InsuranceClaimStatus.SETTLED]: [InsuranceClaimStatus.CLOSED],
    [InsuranceClaimStatus.REJECTED]: [InsuranceClaimStatus.CLOSED],
    [InsuranceClaimStatus.CLOSED]: []
  },
  TRAFFIC_FINE: {
    [FinePaymentStatus.PENDING]: [FinePaymentStatus.PAID, FinePaymentStatus.DISPUTED, FinePaymentStatus.OVERDUE, FinePaymentStatus.WAIVED],
    [FinePaymentStatus.DISPUTED]: [FinePaymentStatus.PAID, FinePaymentStatus.WAIVED, FinePaymentStatus.OVERDUE],
    [FinePaymentStatus.OVERDUE]: [FinePaymentStatus.PAID, FinePaymentStatus.WAIVED, FinePaymentStatus.DISPUTED],
    [FinePaymentStatus.PAID]: [],
    [FinePaymentStatus.WAIVED]: []
  },
  ASSET: {
    [AssetStatus.ACTIVE]: [AssetStatus.UNDER_MAINTENANCE, AssetStatus.INACTIVE, AssetStatus.RETIRED, AssetStatus.DISPOSED],
    [AssetStatus.UNDER_MAINTENANCE]: [AssetStatus.ACTIVE, AssetStatus.INACTIVE, AssetStatus.RETIRED],
    [AssetStatus.INACTIVE]: [AssetStatus.ACTIVE, AssetStatus.RETIRED, AssetStatus.DISPOSED],
    [AssetStatus.RETIRED]: [AssetStatus.DISPOSED],
    [AssetStatus.DISPOSED]: []
  }
};

export function canTransition(
  machine: StateMachineName,
  from?: string | null,
  to?: string | null
): PolicyDecision {
  if (!from || !to) {
    return deny("INVALID_TRANSITION", { machine, from, to }, "CRITICAL");
  }
  if (from === to) {
    return allow("TRANSITION_NOOP", { machine, from, to });
  }
  const allowed = MACHINES[machine]?.[from] ?? [];
  if (!allowed.includes(to)) {
    return deny("INVALID_TRANSITION", { machine, from, to, allowed });
  }
  return allow("TRANSITION_ALLOWED", { machine, from, to });
}

export function allowedTargets(machine: StateMachineName, from: string): string[] {
  return MACHINES[machine]?.[from] ?? [];
}

export { WorkOrderStatus };
