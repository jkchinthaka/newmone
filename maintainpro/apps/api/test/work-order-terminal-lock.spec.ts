import { BadRequestException } from "@nestjs/common";
import { WorkOrderStatus } from "@prisma/client";

import { assertWorkOrderAllowsParts } from "../src/common/utils/work-order-parts-governance";
import { assertWorkOrderAcceptsFieldMutation } from "../src/common/utils/work-order-terminal-lock";

describe("closed and cancelled work order field mutations", () => {
  it("rejects assignee, downtime, and evidence changes", () => {
    expect(() => assertWorkOrderAcceptsFieldMutation(WorkOrderStatus.CLOSED, "modify assignees")).toThrow(
      BadRequestException
    );
    expect(() => assertWorkOrderAcceptsFieldMutation(WorkOrderStatus.CANCELLED, "start downtime")).toThrow(
      /closed or cancelled/
    );
    expect(() => assertWorkOrderAcceptsFieldMutation(WorkOrderStatus.CLOSED, "upload evidence")).toThrow(
      BadRequestException
    );
    expect(() => assertWorkOrderAcceptsFieldMutation(WorkOrderStatus.IN_PROGRESS, "upload evidence")).not.toThrow();
  });

  it("rejects part requests on closed and cancelled work orders", () => {
    expect(() => assertWorkOrderAllowsParts(WorkOrderStatus.CLOSED)).toThrow(BadRequestException);
    expect(() => assertWorkOrderAllowsParts(WorkOrderStatus.CANCELLED)).toThrow(BadRequestException);
    expect(() => assertWorkOrderAllowsParts(WorkOrderStatus.IN_PROGRESS)).not.toThrow();
  });
});
