import { BadRequestException } from "@nestjs/common";
import { PartApprovalTier, WorkOrderPartLineStatus, WorkOrderStatus } from "@prisma/client";

import { TERMINAL_WORK_ORDER_STATUSES } from "./work-order-governance";

export const PART_APPROVAL_MEDIUM_THRESHOLD = Number(process.env.PART_APPROVAL_MEDIUM_THRESHOLD ?? 10_000);
export const PART_APPROVAL_HIGH_THRESHOLD = Number(process.env.PART_APPROVAL_HIGH_THRESHOLD ?? 50_000);

export type PartQuantitySnapshot = {
  requestedQuantity: number;
  approvedQuantity?: number | null;
  reservedQuantity?: number;
  issuedQuantity: number;
  usedQuantity: number;
  returnedQuantity: number;
  damagedQuantity?: number;
  pendingReturnQuantity?: number;
};

export function resolvePartApprovalTier(totalCost: number): PartApprovalTier {
  if (totalCost >= PART_APPROVAL_HIGH_THRESHOLD) {
    return PartApprovalTier.HIGH;
  }
  if (totalCost >= PART_APPROVAL_MEDIUM_THRESHOLD) {
    return PartApprovalTier.MEDIUM;
  }
  return PartApprovalTier.LOW;
}

export function requiresFinanceApprovalForTier(tier: PartApprovalTier, pettyCash?: boolean): boolean {
  return tier === PartApprovalTier.HIGH || Boolean(pettyCash && tier === PartApprovalTier.MEDIUM);
}

export function requiresProcurement(stockAvailable: number, requestedQuantity: number): boolean {
  return stockAvailable < requestedQuantity;
}

export function pendingQuantity(line: PartQuantitySnapshot): number {
  const issued = line.issuedQuantity ?? 0;
  const used = line.usedQuantity ?? 0;
  const returned = line.returnedQuantity ?? 0;
  const damaged = line.damagedQuantity ?? 0;
  const pendingReturn = line.pendingReturnQuantity ?? 0;
  return Math.max(0, issued - used - returned - damaged - pendingReturn);
}

export function assertPositiveQuantity(label: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(`${label} must be greater than 0.`);
  }
}

export function assertWorkOrderAllowsParts(status: WorkOrderStatus, overrideReason?: string) {
  if (!TERMINAL_WORK_ORDER_STATUSES.has(status)) {
    return;
  }
  if (overrideReason?.trim()) {
    return;
  }
  throw new BadRequestException("Work order is closed. Parts cannot be requested or issued without admin override.");
}

export function assertQuantityBalance(line: PartQuantitySnapshot) {
  const consumed = line.usedQuantity + line.returnedQuantity + (line.damagedQuantity ?? 0) + (line.pendingReturnQuantity ?? 0);
  if (consumed > line.issuedQuantity) {
    throw new BadRequestException("Used, returned, and damaged quantities cannot exceed issued quantity.");
  }
}

export function assertApprovedQuantity(requested: number, approved: number, reason?: string) {
  if (approved <= requested) {
    return;
  }
  if (!reason?.trim()) {
    throw new BadRequestException("Approved quantity exceeds requested quantity. Reason is required.");
  }
}

export function assertIssueQuantity(approved: number, issued: number, issueQty: number, overrideReason?: string) {
  if (issueQty <= approved) {
    return;
  }
  if (!overrideReason?.trim()) {
    throw new BadRequestException("Issue quantity cannot exceed approved quantity without override permission and reason.");
  }
}

export function deriveLineStatus(line: PartQuantitySnapshot): WorkOrderPartLineStatus {
  if (line.issuedQuantity <= 0) {
    if (line.approvedQuantity && line.approvedQuantity > 0) {
      return WorkOrderPartLineStatus.APPROVED;
    }
    if (line.requestedQuantity > 0) {
      return WorkOrderPartLineStatus.REQUESTED;
    }
    return WorkOrderPartLineStatus.REQUESTED;
  }

  const pending = pendingQuantity(line);
  if (pending === 0 && line.issuedQuantity > 0) {
    if ((line.damagedQuantity ?? 0) > 0 && line.returnedQuantity === 0) {
      return WorkOrderPartLineStatus.DAMAGED;
    }
    if (line.returnedQuantity >= line.issuedQuantity) {
      return WorkOrderPartLineStatus.RETURNED;
    }
    if (line.usedQuantity >= line.issuedQuantity) {
      return WorkOrderPartLineStatus.USED;
    }
    return WorkOrderPartLineStatus.CLOSED;
  }

  if ((line.pendingReturnQuantity ?? 0) > 0) {
    return WorkOrderPartLineStatus.PARTIALLY_RETURNED;
  }
  if (line.usedQuantity > 0 && line.usedQuantity < line.issuedQuantity) {
    return WorkOrderPartLineStatus.PARTIALLY_USED;
  }
  return WorkOrderPartLineStatus.ISSUED;
}

export function getApprovalTierLabel(tier: PartApprovalTier): string {
  switch (tier) {
    case PartApprovalTier.HIGH:
      return "High-cost — finance approval required";
    case PartApprovalTier.MEDIUM:
      return "Medium-cost — supervisor approval required";
    case PartApprovalTier.LOW:
    default:
      return "Low-cost — supervisor approval";
  }
}
