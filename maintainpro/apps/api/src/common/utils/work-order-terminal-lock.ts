import { BadRequestException } from "@nestjs/common";
import { WorkOrderStatus } from "@prisma/client";

export function isClosedOrCancelledWorkOrder(status: string): boolean {
  return status === WorkOrderStatus.CLOSED || status === WorkOrderStatus.CANCELLED;
}

export function assertWorkOrderAcceptsFieldMutation(status: string, action: string): void {
  if (isClosedOrCancelledWorkOrder(status)) {
    throw new BadRequestException(`Cannot ${action} on a closed or cancelled work order`);
  }
}
