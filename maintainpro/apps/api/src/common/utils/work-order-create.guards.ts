import { BadRequestException } from "@nestjs/common";

import { Priority, WorkOrderType } from "../../database/prisma-enums";

const PRIORITIES = new Set<string>(Object.values(Priority));
const TYPES = new Set<string>(Object.values(WorkOrderType));

export function assertWorkOrderCreateShape(data: {
  priority?: string | null;
  type?: string | null;
  currentOdometer?: number | null;
}) {
  if (!data.priority || !PRIORITIES.has(data.priority)) {
    throw new BadRequestException("Priority must be LOW, MEDIUM, HIGH, or CRITICAL");
  }
  if (!data.type || !TYPES.has(data.type)) {
    throw new BadRequestException("Work order type is not valid");
  }
  if (
    data.currentOdometer != null &&
    (!Number.isFinite(Number(data.currentOdometer)) || Number(data.currentOdometer) < 0)
  ) {
    throw new BadRequestException("Odometer cannot be negative");
  }
}
