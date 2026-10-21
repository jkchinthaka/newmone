import { businessDayWindow } from "../src/modules/work-orders/my-jobs.rules";
import {
  MY_JOB_COUNT_FIELD,
  myJobCountWhere,
  myJobPageSql,
  myJobPageWhere,
  myJobViewWhere,
  myJobViews
} from "../src/modules/work-orders/my-jobs.query";
import { WorkOrderQueuesService } from "../src/modules/work-orders/work-order-queues.service";

const now = new Date("2026-09-29T08:00:00.000+05:30");

describe("my jobs SQL filters", () => {
  const window = businessDayWindow(now);

  it.each(myJobViews())("builds a SQL page for the %s view", (view) => {
    const where = myJobViewWhere(view, now);
    const countWhere = myJobCountWhere("tenant-1", "tech-1", view, now);
    const page = myJobPageSql({
      tenantId: "tenant-1",
      userId: "tech-1",
      view,
      filters: {},
      now,
      skip: 25,
      take: 25
    });
    const text = page.strings.join(" ");

    expect(where).toBeTruthy();
    expect(JSON.stringify(countWhere)).toContain("tenant-1");
    expect(JSON.stringify(countWhere)).toContain("tech-1");
    expect(text).toContain("OFFSET");
    expect(text).toContain("FETCH NEXT");
    expect(text).toContain("WHEN N'CRITICAL' THEN 0");
    expect(JSON.stringify(page.values)).toContain("tenant-1");
    expect(JSON.stringify(page.values)).toContain("tech-1");
    expect(MY_JOB_COUNT_FIELD[view]).toEqual(expect.any(String));

    if (view === "active") expect(where).toEqual({ status: { notIn: ["CLOSED", "CANCELLED", "COMPLETED"] } });
    if (view === "completed") expect(where).toEqual({ status: { in: ["COMPLETED", "CLOSED"] } });
    if (view === "in-progress") expect(where).toEqual({ status: "IN_PROGRESS" });
    if (view === "rework-required") expect(where).toEqual({ status: "REWORK_REQUIRED" });
    if (view === "due-today") expect(where).toEqual({ dueDate: { gte: window.start, lte: window.end } });
    if (view === "overdue") expect(text).toContain("OVERDUE");
    if (view === "waiting-parts") expect(text).toContain("REQUESTED");
    if (view === "evidence-needed") expect(text).toContain("REJECTED");
  });

  it("applies search, status, priority, and due on the page where only", () => {
    const page = myJobPageWhere("tenant-1", "tech-1", "active", {
      search: "pump",
      status: "ASSIGNED",
      priority: "HIGH",
      due: "today"
    }, now);
    expect(JSON.stringify(page)).toContain("pump");
    expect(JSON.stringify(page)).toContain("ASSIGNED");
    expect(JSON.stringify(myJobCountWhere("tenant-1", "tech-1", "active", now))).not.toContain("pump");
  });
});

describe("listMyJobs uses SQL pagination", () => {
  const actor = { sub: "tech-1", email: "tech@maintainpro.local", role: "TECHNICIAN", tenantId: "tenant-1" };
  const row = (id: string, version: number) => ({
    id,
    woNumber: id,
    title: "Pump",
    status: "ASSIGNED",
    priority: "HIGH",
    dueDate: null,
    approvalStatus: "APPROVED",
    version,
    asset: null,
    functionalLocation: null,
    site: null
  });

  it("keeps the database order and does not cap the assigned total", async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: "wo-b" }, { id: "wo-a" }]);
    const findMany = jest.fn().mockResolvedValue([row("wo-a", 2), row("wo-b", 4)]);
    const count = jest.fn().mockResolvedValue(600);
    const prisma = { workOrder: { findMany, count }, $queryRaw: queryRaw };
    const service = new WorkOrderQueuesService(prisma as never, {} as never, {} as never);

    const result = await service.listMyJobs(actor as never, { view: "overdue", page: "2", pageSize: "25" });

    expect(result.items.map((item) => item.id)).toEqual(["wo-b", "wo-a"]);
    expect(result.items[0].version).toBe(4);
    expect(result.capped).toBe(false);
    expect(result.assignedTotal).toBe(600);
    expect(result.total).toBe(600);
    expect(result.page).toBe(2);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "tenant-1", id: { in: ["wo-b", "wo-a"] } });
    expect(findMany.mock.calls[0][0].select.version).toBe(true);
    const overdueCounts = count.mock.calls.filter((call) => JSON.stringify(call[0].where).includes("OVERDUE"));
    expect(overdueCounts.length).toBeGreaterThan(0);
  });
});
