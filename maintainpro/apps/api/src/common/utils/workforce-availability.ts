import { BadRequestException } from "@nestjs/common";

import { EmployeeAvailabilityStatus } from "../../database/prisma-enums";

export const WORKFORCE_AVAILABILITY_STATUSES = [
  EmployeeAvailabilityStatus.AVAILABLE,
  EmployeeAvailabilityStatus.ON_LEAVE,
  EmployeeAvailabilityStatus.INACTIVE
] as const;

/**
 * Workforce Master creation availability.
 * PeopleService.parseAvailability already stores AVAILABLE when the field is omitted.
 * A blank or unrecognized value is unknown and is rejected. It is not stored as AVAILABLE.
 */
export function workforceMasterAvailability(value: string | undefined): EmployeeAvailabilityStatus {
  if (value === undefined) {
    return EmployeeAvailabilityStatus.AVAILABLE;
  }

  const normalized = value.trim().toUpperCase();
  if ((WORKFORCE_AVAILABILITY_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as EmployeeAvailabilityStatus;
  }

  throw new BadRequestException(
    "availabilityStatus must be AVAILABLE, ON_LEAVE, or INACTIVE. Blank availability is not treated as available."
  );
}
