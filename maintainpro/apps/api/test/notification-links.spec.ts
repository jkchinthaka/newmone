import { NotificationPriority } from "@prisma/client";

import { notificationContextHref, notificationListPage, notificationListWhere } from "../src/modules/notifications/notification-links";

describe("notification inbox query", () => {
  it("scopes the list to the user and the active filters", () => {
    const where = notificationListWhere("user-1", {
      status: "UNREAD",
      priority: NotificationPriority.CRITICAL,
      search: "MH-01",
      module: "fleet",
      acknowledged: "no",
      overdue: true
    });

    expect(where.userId).toBe("user-1");
    expect(where.isRead).toBe(false);
    expect(where.priority).toEqual({ in: [NotificationPriority.CRITICAL] });
    expect(where.acknowledgedAt).toBeNull();
    expect(where.dueAt).toEqual({ lt: expect.any(Date) });
    expect(where.OR).toEqual([
      { title: { contains: "MH-01" } },
      { message: { contains: "MH-01" } },
      { referenceId: { contains: "MH-01" } }
    ]);
  });

  it("uses 20, 50, or 100 as page sizes", () => {
    expect(notificationListPage({ pageSize: 15 }).pageSize).toBe(20);
    expect(notificationListPage({ pageSize: 50 }).pageSize).toBe(50);
    expect(notificationListPage({ page: 0 }).page).toBe(1);
  });

  it("opens the work order and gate records directly", () => {
    expect(notificationContextHref({ referenceType: "WorkOrder", referenceId: "wo-1", type: "WORK_ORDER_ASSIGNED" })).toBe(
      "/work-orders?wo=wo-1"
    );
    expect(notificationContextHref({ referenceType: "Vehicle", referenceId: "veh-1", title: "Gate blocked" })).toBe(
      "/fleet/gate?vehicle=veh-1"
    );
  });
});
