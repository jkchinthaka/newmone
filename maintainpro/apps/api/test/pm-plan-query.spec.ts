import { buildPmPlanListQuery } from "../src/modules/planning/pm-plan-query";

describe("PM plan list query", () => {
  const now = new Date("2026-10-08T00:00:00.000Z");

  it("keeps tenant scope on the page query and every summary count", () => {
    const query = buildPmPlanListQuery(
      "tenant-1",
      { dueWindow: "overdue", page: 2, pageSize: 25, search: "pump" },
      now
    );
    const clauses = query.where.AND as Array<{ tenantId?: string; OR?: unknown; nextDueAt?: { lt?: Date } }>;
    expect(query.skip).toBe(25);
    expect(query.take).toBe(25);
    expect(clauses[0]?.tenantId).toBe("tenant-1");
    expect(JSON.stringify(clauses[0]?.OR)).toContain("pump");
    expect(clauses[1]?.nextDueAt?.lt).toEqual(now);
    for (const count of Object.values(query.counts)) {
      const scoped = count.AND as Array<{ tenantId?: string }>;
      expect(scoped[0]?.tenantId).toBe("tenant-1");
    }
  });

  it("maps a soon window to the next seven days for calendar triggers", () => {
    const soon = buildPmPlanListQuery("tenant-1", { dueWindow: "soon", trigger: "CALENDAR", page: Number.NaN, pageSize: Number.NaN }, now);
    const clauses = soon.where.AND as Array<{ triggers?: { some?: { kind?: string } }; nextDueAt?: { gte?: Date; lte?: Date } }>;
    expect(soon.page).toBe(1);
    expect(soon.pageSize).toBe(25);
    expect(clauses[0]?.triggers?.some?.kind).toBe("CALENDAR");
    expect(clauses[1]?.nextDueAt?.gte).toEqual(now);
    expect(clauses[1]?.nextDueAt?.lte).toEqual(new Date(now.getTime() + 7 * 86_400_000));
  });
});
