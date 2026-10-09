import { fleetExpiringDocsWhere, fleetServiceListWhere, openAccidentRepairWhere } from "../src/modules/fleet-lifecycle/fleet-list-filters";

describe("fleet list filters", () => {
  const now = new Date("2026-10-09T00:00:00.000Z");

  it("uses the same 30-day service window as the fleet overview", () => {
    expect(fleetServiceListWhere("overdue", now)).toEqual({
      nextServiceDate: { lt: now }
    });
    expect(fleetServiceListWhere("due-soon", now)).toEqual({
      nextServiceDate: { gte: now, lte: new Date("2026-11-08T00:00:00.000Z") }
    });
  });

  it("counts expiring insurance and road tax the same way as the document strip", () => {
    expect(fleetExpiringDocsWhere(now)).toEqual({
      OR: [
        { insuranceExpiry: { gte: now, lte: new Date("2026-11-08T00:00:00.000Z") } },
        { roadTaxExpiry: { gte: now, lte: new Date("2026-11-08T00:00:00.000Z") } }
      ]
    });
  });

  it("open repairs are accident reports with an open accident-repair work order", () => {
    expect(openAccidentRepairWhere()).toEqual({
      workOrders: {
        some: {
          type: "ACCIDENT_REPAIR",
          status: { notIn: ["CLOSED", "CANCELLED"] }
        }
      }
    });
  });
});
