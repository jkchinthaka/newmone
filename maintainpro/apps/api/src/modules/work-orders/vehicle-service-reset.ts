const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Vehicle service fields after a preventive (service) job on the vehicle is closed.
 * Next service is measured from this service: the reading taken at completion and the close date.
 * Without an interval, a due target that has already passed is cleared so the gate stops
 * reporting "service overdue" for a vehicle that was just serviced.
 */
export function vehicleServiceAfterClose(input: {
  closedAt: Date;
  reading: number;
  intervalDays?: number | null;
  intervalMileage?: number | null;
  nextServiceDate?: Date | null;
  nextServiceMileage?: number | null;
}) {
  const days = input.intervalDays && input.intervalDays > 0 ? input.intervalDays : null;
  const km = input.intervalMileage && input.intervalMileage > 0 ? input.intervalMileage : null;

  const nextServiceDate = days
    ? new Date(input.closedAt.getTime() + days * DAY_MS)
    : input.nextServiceDate && input.nextServiceDate > input.closedAt
      ? input.nextServiceDate
      : null;
  const nextServiceMileage = km
    ? input.reading + km
    : input.nextServiceMileage != null && input.nextServiceMileage > input.reading
      ? input.nextServiceMileage
      : null;

  return {
    lastServiceDate: input.closedAt,
    nextServiceDate,
    nextServiceMileage,
    serviceStatus: "ON_SCHEDULE"
  };
}
