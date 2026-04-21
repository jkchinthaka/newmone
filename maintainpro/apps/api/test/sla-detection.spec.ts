import { Priority } from "@prisma/client";

import { calculateSlaDeadline, isSlaBreached } from "../src/common/utils/work-order-sla";

describe("work order sla", () => {
  it("sets critical sla to 4 hours", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const deadline = calculateSlaDeadline(Priority.CRITICAL, start);

    expect(deadline.toISOString()).toBe("2026-01-01T04:00:00.000Z");
  });

  it("marks breached when completed after deadline", () => {
    const deadline = new Date("2026-01-01T10:00:00.000Z");
    const completed = new Date("2026-01-01T10:00:01.000Z");

    expect(isSlaBreached(deadline, completed)).toBe(true);
  });
});
