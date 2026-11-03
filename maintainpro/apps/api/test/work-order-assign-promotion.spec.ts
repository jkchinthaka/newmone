import { readFileSync } from "node:fs";
import { join } from "node:path";

import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";

type PromoteInput = {
  id: string;
  status: string;
  approvalStatus: string;
  technicianId?: string | null;
  version?: number | null;
};

const promote = (WorkOrdersService.prototype as unknown as {
  promoteSuppliedTechnician: (this: unknown, workOrder: PromoteInput, actor?: { sub: string }) => Promise<boolean>;
}).promoteSuppliedTechnician;

function context(assignImpl?: () => Promise<unknown>) {
  return {
    assign: jest.fn(assignImpl ?? (async () => ({}))),
    logger: { warn: jest.fn() }
  };
}

const actor = { sub: "manager-1" };
const approvedOpen: PromoteInput = {
  id: "wo-1",
  status: "OPEN",
  approvalStatus: "APPROVED",
  technicianId: "tech-1",
  version: 3
};

describe("technician picked on a job moves it to ASSIGNED", () => {
  it("assigns an approved OPEN job through the normal assign path", async () => {
    const ctx = context();
    await expect(promote.call(ctx, approvedOpen, actor)).resolves.toBe(true);
    expect(ctx.assign).toHaveBeenCalledWith("wo-1", "tech-1", actor, { expectedVersion: 3 });
  });

  it("also promotes PLANNED and NOT_REQUIRED approval", async () => {
    const ctx = context();
    await expect(
      promote.call(ctx, { ...approvedOpen, status: "PLANNED", approvalStatus: "NOT_REQUIRED" }, actor)
    ).resolves.toBe(true);
    expect(ctx.assign).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["approval pending", { approvalStatus: "PENDING" }],
    ["approval rejected", { approvalStatus: "REJECTED" }],
    ["no technician", { technicianId: null }],
    ["already started", { status: "IN_PROGRESS" }],
    ["already assigned", { status: "ASSIGNED" }]
  ])("leaves the job alone when %s", async (_label, patch) => {
    const ctx = context();
    await expect(promote.call(ctx, { ...approvedOpen, ...patch }, actor)).resolves.toBe(false);
    expect(ctx.assign).not.toHaveBeenCalled();
  });

  it("does nothing without a signed-in actor", async () => {
    const ctx = context();
    await expect(promote.call(ctx, approvedOpen, undefined)).resolves.toBe(false);
    expect(ctx.assign).not.toHaveBeenCalled();
  });

  it("keeps the saved job OPEN and logs when assign refuses", async () => {
    const ctx = context(async () => {
      throw new Error("Employee cannot receive work orders");
    });
    await expect(promote.call(ctx, approvedOpen, actor)).resolves.toBe(false);
    expect(ctx.logger.warn).toHaveBeenCalledTimes(1);
  });

  it("is wired into create, update and the assignees endpoint", () => {
    const service = readFileSync(join(__dirname, "../src/modules/work-orders/work-orders.service.ts"), "utf8");
    const controller = readFileSync(join(__dirname, "../src/modules/work-orders/work-orders.controller.ts"), "utf8");
    expect(service).toMatch(/!options\?\.tx && \(await this\.promoteSuppliedTechnician\(synced, actor\)\)/);
    expect(service).toMatch(/validatedTechnicianId && \(await this\.promoteSuppliedTechnician\(updated, actor\)\)/);
    expect(controller).toMatch(/addAssignee\(id, body, req\.user\);\s*\/\/[^\n]*\n\s*await this\.workOrdersService\.promoteAssignedTechnician\(id, req\.user\);/);
  });
});
