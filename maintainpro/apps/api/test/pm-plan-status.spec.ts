import { BadRequestException } from "@nestjs/common";

import { assertPmPlanStatusTransition } from "../src/modules/planning/planning.service";

describe("PM plan status transitions", () => {
  it("allows suspend and restore without a paused status", () => {
    expect(() => assertPmPlanStatusTransition("ACTIVE", "INACTIVE")).not.toThrow();
    expect(() => assertPmPlanStatusTransition("INACTIVE", "ACTIVE")).not.toThrow();
  });

  it("rejects a retired plan returning to active", () => {
    expect(() => assertPmPlanStatusTransition("RETIRED", "ACTIVE")).toThrow(BadRequestException);
  });
});
