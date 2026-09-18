import { POStatus } from "@prisma/client";

/**
 * After a successful ERP sync, promote stock lifecycle status to ORDERED when
 * the PO is still awaiting ERP (PENDING) or has a legacy blank default.
 * Do not demote PARTIALLY_RECEIVED / RECEIVED / CANCELLED / already ORDERED.
 */
export function shouldPromotePoStatusToOrdered(status: string | null | undefined): boolean {
  return status === POStatus.PENDING || !status;
}
