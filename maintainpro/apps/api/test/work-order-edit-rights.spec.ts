import { ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { assertJobDetailsEditableBy } from "../src/modules/work-orders/work-order-edit-rights";

describe("job detail edit rights", () => {
  const existing = { title: "Replace pump seal", description: "Leaking", estimatedCost: 1500, estimatedHours: 2 };

  it("lets Admin and Super Admin change the job details", () => {
    for (const role of [RoleName.ADMIN, RoleName.SUPER_ADMIN]) {
      expect(() => assertJobDetailsEditableBy(role, existing, { title: "Replace pump", estimatedCost: 900 })).not.toThrow();
    }
  });

  it("blocks managers from changing title, description, cost or hours", () => {
    for (const data of [{ title: "Other" }, { description: "x" }, { estimatedCost: 1 }, { estimatedHours: 9 }]) {
      expect(() => assertJobDetailsEditableBy(RoleName.MANAGER, existing, data)).toThrow(ForbiddenException);
    }
  });

  it("lets managers plan: unchanged details plus new dates or technician pass", () => {
    expect(() =>
      assertJobDetailsEditableBy(RoleName.MANAGER, existing, {
        title: " Replace pump seal ",
        estimatedCost: 1500,
        dueDate: "2026-11-01"
      } as never)
    ).not.toThrow();
    expect(() => assertJobDetailsEditableBy(RoleName.OPERATIONS_MANAGER, existing, { plannedStartAt: "2026-11-01" } as never)).not.toThrow();
  });
});
