import { BadRequestException } from "@nestjs/common";

import { assertWorkOrderCreateShape } from "../src/common/utils/work-order-create.guards";

describe("work order create guards", () => {
  it("rejects an unknown priority before a record is written", () => {
    expect(() => assertWorkOrderCreateShape({ priority: "NOT_A_PRIORITY", type: "CORRECTIVE" })).toThrow(
      BadRequestException
    );
  });

  it("rejects an unknown type before a record is written", () => {
    expect(() => assertWorkOrderCreateShape({ priority: "LOW", type: "NOT_A_TYPE" })).toThrow(BadRequestException);
  });

  it("rejects a negative odometer", () => {
    expect(() =>
      assertWorkOrderCreateShape({ priority: "LOW", type: "CORRECTIVE", currentOdometer: -3 })
    ).toThrow(BadRequestException);
  });

  it("accepts a normal corrective work order", () => {
    expect(() =>
      assertWorkOrderCreateShape({ priority: "LOW", type: "CORRECTIVE", currentOdometer: 0 })
    ).not.toThrow();
  });
});
