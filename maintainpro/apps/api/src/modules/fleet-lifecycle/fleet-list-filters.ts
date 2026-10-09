/** Shared fleet list predicates. Overview counts and list queries must use these. */

export const FLEET_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type FleetServiceFilter = "overdue" | "due-soon" | "current";

export function fleetWindowEnd(now: Date): Date {
  return new Date(now.getTime() + FLEET_WINDOW_MS);
}

export function fleetServiceListWhere(service: FleetServiceFilter, now: Date) {
  const end = fleetWindowEnd(now);
  if (service === "overdue") {
    return { nextServiceDate: { lt: now } };
  }
  if (service === "due-soon") {
    return { nextServiceDate: { gte: now, lte: end } };
  }
  return {
    OR: [{ nextServiceDate: null }, { nextServiceDate: { gt: end } }]
  };
}

/** Same 30-day insurance / road-tax window as the fleet overview document count. */
export function fleetExpiringDocsWhere(now: Date) {
  const end = fleetWindowEnd(now);
  return {
    OR: [
      { insuranceExpiry: { gte: now, lte: end } },
      { roadTaxExpiry: { gte: now, lte: end } }
    ]
  };
}

/** Accident reports that still have an open accident-repair work order. */
export function openAccidentRepairWhere() {
  return {
    workOrders: {
      some: {
        type: "ACCIDENT_REPAIR" as const,
        status: { notIn: ["CLOSED", "CANCELLED"] as ["CLOSED", "CANCELLED"] }
      }
    }
  };
}
