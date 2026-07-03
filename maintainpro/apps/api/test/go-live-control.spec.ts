import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  CutoverItemStatus,
  GoLiveDecisionOption,
  GoLiveSignOffDecision,
  PilotRolloutStatus,
  RoleName,
  RolloutWaveStatus
} from "@prisma/client";

import { CutoverChecklistService } from "../src/modules/go-live/cutover-checklist.service";
import { DecisionBoardService } from "../src/modules/go-live/decision-board.service";
import { GoLiveSignOffService } from "../src/modules/go-live/go-live-signoff.service";
import { PilotRolloutService } from "../src/modules/go-live/pilot-rollout.service";
import { RollbackPlanService } from "../src/modules/go-live/rollback-plan.service";
import { RolloutWavesService } from "../src/modules/go-live/rollout-waves.service";

const mockCtx: {
  actorId: string;
  actorRole: RoleName;
  tenantId: string;
  permissions: string[];
} = {
  actorId: "admin-1",
  actorRole: RoleName.ADMIN,
  tenantId: "tenant-1",
  permissions: ["go_live.view", "go_live.manage", "go_live.sign_off", "go_live.export"]
};

jest.mock("../src/common/context/request-context", () => ({
  requestContext: { get: jest.fn(() => mockCtx) }
}));

const buildPrisma = () => ({
  pilotRollout: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  cutoverChecklistItem: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn() },
  rolloutWave: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  goLiveDecision: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  rollbackPlan: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  goLiveSignOff: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  qaIssue: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  supportTicket: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  trainingSession: { count: jest.fn() },
  workOrder: { count: jest.fn() },
  auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
});

describe("Go-Live Control (UAT-028)", () => {
  beforeEach(() => {
    mockCtx.actorRole = RoleName.ADMIN;
    mockCtx.permissions = ["go_live.view", "go_live.manage", "go_live.sign_off", "go_live.export"];
    jest.clearAllMocks();
  });

  it("creates pilot rollout", async () => {
    const prisma = buildPrisma();
    prisma.pilotRollout.create.mockResolvedValue({ id: "p1", pilotName: "Wave 1", status: PilotRolloutStatus.PLANNED });

    const cutover = new CutoverChecklistService(prisma as never);
    const service = new PilotRolloutService(prisma as never, cutover);
    const created = await service.create({ pilotName: "Maintenance Pilot", department: "Maintenance" });
    expect(created.pilotName).toBe("Wave 1");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("pilot cannot start without training/backup readiness", async () => {
    const prisma = buildPrisma();
    prisma.pilotRollout.findFirst.mockResolvedValue({ id: "p1", tenantId: "tenant-1", status: PilotRolloutStatus.PLANNED });
    prisma.cutoverChecklistItem.count.mockResolvedValue(1);
    prisma.cutoverChecklistItem.findMany.mockResolvedValue([
      { itemKey: "training.admin", status: CutoverItemStatus.NOT_STARTED, blocker: true }
    ]);

    const cutover = new CutoverChecklistService(prisma as never);
    const service = new PilotRolloutService(prisma as never, cutover);
    await expect(service.start("p1")).rejects.toThrow(BadRequestException);
  });

  it("updates cutover checklist item", async () => {
    const prisma = buildPrisma();
    prisma.cutoverChecklistItem.findFirst.mockResolvedValue({
      id: "c1",
      tenantId: "tenant-1",
      status: CutoverItemStatus.NOT_STARTED
    });
    prisma.cutoverChecklistItem.update.mockResolvedValue({ id: "c1", status: CutoverItemStatus.PASS });

    const service = new CutoverChecklistService(prisma as never);
    const updated = await service.updateItem("c1", { status: CutoverItemStatus.PASS });
    expect(updated.status).toBe(CutoverItemStatus.PASS);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("creates rollout wave", async () => {
    const prisma = buildPrisma();
    prisma.rolloutWave.create.mockResolvedValue({ id: "w1", waveNo: 1, waveName: "Supervisors", status: RolloutWaveStatus.PLANNED });

    const service = new RolloutWavesService(prisma as never);
    const wave = await service.create({ waveNo: 1, waveName: "Supervisors + Technicians" });
    expect(wave.waveNo).toBe(1);
  });

  it("blocks next wave when critical blockers exist", async () => {
    const prisma = buildPrisma();
    prisma.rolloutWave.findFirst
      .mockResolvedValueOnce({ id: "w2", waveNo: 2, tenantId: "tenant-1" })
      .mockResolvedValueOnce({ id: "w1", waveNo: 1, status: RolloutWaveStatus.ACTIVE })
      .mockResolvedValueOnce(null);
    prisma.qaIssue.count.mockResolvedValue(1);
    prisma.supportTicket.count.mockResolvedValue(0);

    const service = new RolloutWavesService(prisma as never);
    await expect(service.start("w2")).rejects.toThrow(BadRequestException);
  });

  it("go/no-go blocks GO when critical issue exists", async () => {
    const prisma = buildPrisma();
    prisma.qaIssue.count.mockResolvedValue(2);
    prisma.supportTicket.count.mockResolvedValue(0);
    prisma.cutoverChecklistItem.count.mockResolvedValue(5);
    prisma.cutoverChecklistItem.findMany.mockResolvedValue([]);
    prisma.rollbackPlan.findFirst.mockResolvedValue({ rollbackSteps: "steps", databaseRestoreReference: "ref" });
    prisma.goLiveSignOff.findMany.mockResolvedValue([]);

    const cutover = new CutoverChecklistService(prisma as never);
    const signOff = new GoLiveSignOffService(prisma as never);
    const decisions = new DecisionBoardService(prisma as never, cutover, signOff);

    await expect(decisions.recordDecision({ decision: GoLiveDecisionOption.GO })).rejects.toThrow(BadRequestException);
  });

  it("creates rollback plan", async () => {
    const prisma = buildPrisma();
    prisma.rollbackPlan.count.mockResolvedValue(0);
    prisma.rollbackPlan.updateMany.mockResolvedValue({ count: 0 });
    prisma.rollbackPlan.create.mockResolvedValue({
      id: "rb1",
      rollbackPlanNo: "RB-0001",
      rollbackSteps: "Revert deploy",
      databaseRestoreReference: "backup-2026"
    });

    const service = new RollbackPlanService(prisma as never);
    const plan = await service.create({
      versionBeforeGoLive: "1.1.0",
      rollbackSteps: "Revert to previous Render deploy and restore MongoDB snapshot.",
      databaseRestoreReference: "backup-2026-07-01"
    });
    expect(plan.rollbackPlanNo).toBe("RB-0001");
  });

  it("sign-off with accepted risk requires reason", async () => {
    const prisma = buildPrisma();
    const service = new GoLiveSignOffService(prisma as never);
    await expect(
      service.createSignOff({ signOffRole: "IT_MANAGER", decision: GoLiveSignOffDecision.APPROVED_WITH_RISK })
    ).rejects.toThrow(BadRequestException);
  });

  it("creates sign-off with accepted risk when reason provided", async () => {
    const prisma = buildPrisma();
    prisma.goLiveSignOff.create.mockResolvedValue({
      id: "s1",
      signOffRole: "IT_MANAGER",
      decision: GoLiveSignOffDecision.APPROVED_WITH_RISK
    });

    const service = new GoLiveSignOffService(prisma as never);
    const signOff = await service.createSignOff({
      signOffRole: "IT_MANAGER",
      decision: GoLiveSignOffDecision.APPROVED_WITH_RISK,
      acceptedRisks: "Minor UI spacing issues on mobile reports."
    });
    expect(signOff.decision).toBe(GoLiveSignOffDecision.APPROVED_WITH_RISK);
  });

  it("blocks unauthorized user from managing pilots", async () => {
    mockCtx.permissions = [];
    mockCtx.actorRole = RoleName.TECHNICIAN;
    const prisma = buildPrisma();
    const cutover = new CutoverChecklistService(prisma as never);
    const service = new PilotRolloutService(prisma as never, cutover);
    await expect(service.create({ pilotName: "Test" })).rejects.toThrow(ForbiddenException);
  });

  it("pilot cannot complete with open critical blockers", async () => {
    const prisma = buildPrisma();
    prisma.pilotRollout.findFirst.mockResolvedValue({ id: "p1", tenantId: "tenant-1" });
    prisma.qaIssue.count.mockResolvedValue(1);
    prisma.supportTicket.count.mockResolvedValue(0);

    const cutover = new CutoverChecklistService(prisma as never);
    const service = new PilotRolloutService(prisma as never, cutover);
    await expect(service.complete("p1")).rejects.toThrow(BadRequestException);
  });
});
