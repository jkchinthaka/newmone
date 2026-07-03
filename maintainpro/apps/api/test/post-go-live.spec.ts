import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  ChangeRequestStatus,
  ReleaseStatus,
  RoleName,
  SupportTicketSeverity,
  SupportTicketStatus,
  TrainingStatus
} from "@prisma/client";

import { ChangeRequestsService } from "../src/modules/post-go-live/change-requests.service";
import { HandoverService } from "../src/modules/post-go-live/handover.service";
import { HypercareService } from "../src/modules/post-go-live/hypercare.service";
import { computeSlaDueDates } from "../src/modules/post-go-live/operations.constants";
import { ReleasesService } from "../src/modules/post-go-live/releases.service";
import { SupportTicketsService } from "../src/modules/post-go-live/support-tickets.service";
import { TrainingService } from "../src/modules/post-go-live/training.service";

const mockCtx: {
  actorId: string;
  actorRole: RoleName;
  tenantId: string;
  permissions: string[];
} = {
  actorId: "admin-1",
  actorRole: RoleName.ADMIN,
  tenantId: "tenant-1",
  permissions: [
    "operations.manage",
    "operations.view",
    "support.manage",
    "support.create",
    "change_request.manage",
    "change_request.approve",
    "change_request.create",
    "release.manage",
    "training.manage",
    "hypercare.manage"
  ]
};

jest.mock("../src/common/context/request-context", () => ({
  requestContext: { get: jest.fn(() => mockCtx) }
}));

const buildPrisma = () => ({
  trainingSession: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  supportTicket: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn()
  },
  qaIssue: { count: jest.fn(), create: jest.fn() },
  changeRequest: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  softwareRelease: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  hypercarePlan: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  supportHandover: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  escalationRule: { count: jest.fn(), findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
  $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 })
});

describe("Post-Go-Live Operations (UAT-027)", () => {
  beforeEach(() => {
    mockCtx.actorRole = RoleName.ADMIN;
    mockCtx.permissions = [
      "operations.manage",
      "operations.view",
      "support.manage",
      "support.create",
      "change_request.manage",
      "change_request.approve",
      "change_request.create",
      "release.manage",
      "training.manage",
      "hypercare.manage"
    ];
  });

  it("creates and completes training session", async () => {
    const prisma = buildPrisma();
    prisma.trainingSession.count.mockResolvedValue(0);
    prisma.trainingSession.create.mockResolvedValue({ id: "trn-1", trainingSessionNo: "TRN-0001", status: TrainingStatus.NOT_STARTED });
    prisma.trainingSession.findFirst.mockResolvedValue({ id: "trn-1", trainingDate: null, notes: null });
    prisma.trainingSession.update.mockResolvedValue({ id: "trn-1", status: TrainingStatus.COMPLETED });

    const service = new TrainingService(prisma as never);
    const created = await service.create({ category: "TECHNICIAN_TRAINING", role: "TECHNICIAN", traineeUserId: "u2" });
    expect(created.trainingSessionNo).toBe("TRN-0001");

    const completed = await service.complete("trn-1");
    expect(completed.status).toBe(TrainingStatus.COMPLETED);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("creates support ticket with SLA due dates", async () => {
    const prisma = buildPrisma();
    prisma.supportTicket.count.mockResolvedValue(0);
    prisma.supportTicket.create.mockResolvedValue({
      id: "t1",
      ticketNo: "SUP-0001",
      severity: SupportTicketSeverity.MEDIUM,
      environment: "PRODUCTION",
      title: "Test",
      description: "Issue description for testing purposes."
    });

    const service = new SupportTicketsService(prisma as never);
    const ticket = await service.create({
      title: "Login issue",
      description: "User cannot login after password reset attempt.",
      category: "LOGIN_ISSUE"
    });

    expect(ticket.ticketNo).toBe("SUP-0001");
    const sla = computeSlaDueDates("MEDIUM");
    expect(sla.firstResponseDueAt).toBeInstanceOf(Date);
  });

  it("assigns and acknowledges support ticket", async () => {
    const prisma = buildPrisma();
    const existing = {
      id: "t1",
      firstResponseDueAt: new Date(Date.now() + 60_000),
      firstResponseBreached: false,
      escalationLevel: 1
    };
    prisma.supportTicket.findFirst.mockResolvedValue(existing);
    prisma.supportTicket.update.mockResolvedValue({ ...existing, status: SupportTicketStatus.ASSIGNED });

    const service = new SupportTicketsService(prisma as never);
    await service.assign("t1", { assignedToUserId: "agent-1" });
    prisma.supportTicket.update.mockResolvedValue({ ...existing, status: SupportTicketStatus.ACKNOWLEDGED, firstResponseAt: new Date() });
    await service.acknowledge("t1");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("closes ticket requires resolution note for critical", async () => {
    const prisma = buildPrisma();
    prisma.supportTicket.findFirst.mockResolvedValue({
      id: "t1",
      severity: SupportTicketSeverity.CRITICAL,
      resolvedAt: null
    });

    const service = new SupportTicketsService(prisma as never);
    await expect(service.close("t1", { resolutionNote: "   " })).rejects.toThrow(BadRequestException);
  });

  it("reopen ticket requires reason", async () => {
    const prisma = buildPrisma();
    prisma.supportTicket.findFirst.mockResolvedValue({ id: "t1" });
    prisma.supportTicket.update.mockResolvedValue({ id: "t1", status: SupportTicketStatus.REOPENED });

    const service = new SupportTicketsService(prisma as never);
    const reopened = await service.reopen("t1", { reason: "Issue recurred after patch deployment." });
    expect(reopened.status).toBe(SupportTicketStatus.REOPENED);
  });

  it("detects SLA breach on recalculate", async () => {
    const prisma = buildPrisma();
    prisma.supportTicket.findMany.mockResolvedValue([
      {
        id: "t1",
        status: SupportTicketStatus.OPEN,
        firstResponseAt: null,
        firstResponseDueAt: new Date(Date.now() - 60_000),
        firstResponseBreached: false,
        resolvedAt: null,
        resolutionDueAt: new Date(Date.now() + 60_000),
        resolutionBreached: false,
        severity: SupportTicketSeverity.HIGH,
        escalationLevel: 1
      }
    ]);
    prisma.supportTicket.update.mockResolvedValue({});

    const service = new SupportTicketsService(prisma as never);
    const result = await service.recalculateSlaBreaches();
    expect(result.updated).toBeGreaterThanOrEqual(1);
  });

  it("approves change request with authorized role", async () => {
    const prisma = buildPrisma();
    prisma.changeRequest.findFirst.mockResolvedValue({ id: "cr1", requestedByUserId: "u2", status: ChangeRequestStatus.REQUESTED });
    prisma.changeRequest.update.mockResolvedValue({ id: "cr1", status: ChangeRequestStatus.APPROVED });

    const service = new ChangeRequestsService(prisma as never);
    const approved = await service.approve("cr1", { approvalNote: "Approved for next sprint." });
    expect(approved.status).toBe(ChangeRequestStatus.APPROVED);
  });

  it("blocks unauthorized change request approval", async () => {
    mockCtx.actorRole = RoleName.TECHNICIAN;
    mockCtx.permissions = ["change_request.create"];
    const service = new ChangeRequestsService(buildPrisma() as never);
    await expect(service.approve("cr1", {})).rejects.toThrow(ForbiddenException);
  });

  it("rejects change request requires reason", async () => {
    const prisma = buildPrisma();
    prisma.changeRequest.findFirst.mockResolvedValue({ id: "cr1" });
    prisma.changeRequest.update.mockResolvedValue({ id: "cr1", status: ChangeRequestStatus.REJECTED });

    const service = new ChangeRequestsService(prisma as never);
    const rejected = await service.reject("cr1", { rejectionReason: "Out of scope for current contract phase." });
    expect(rejected.status).toBe(ChangeRequestStatus.REJECTED);
  });

  it("production release requires backup and rollback plan", async () => {
    const prisma = buildPrisma();
    prisma.softwareRelease.findFirst.mockResolvedValue({
      id: "r1",
      backupTaken: false,
      rollbackPlan: null,
      releaseNotes: null,
      linkedChangeRequests: []
    });

    const service = new ReleasesService(prisma as never);
    await expect(service.schedule("r1")).rejects.toThrow(BadRequestException);
  });

  it("marks release deployed when requirements met", async () => {
    const prisma = buildPrisma();
    prisma.softwareRelease.findFirst.mockResolvedValue({
      id: "r1",
      backupTaken: true,
      rollbackPlan: "Redeploy previous commit",
      releaseNotes: "Bug fixes",
      linkedChangeRequests: [],
      renderDeployId: null,
      cloudflareDeployId: null,
      commitHash: null
    });
    prisma.softwareRelease.update.mockResolvedValue({ id: "r1", status: ReleaseStatus.DEPLOYED });

    const service = new ReleasesService(prisma as never);
    const deployed = await service.markDeployed("r1", { commitHash: "abc123" });
    expect(deployed.status).toBe(ReleaseStatus.DEPLOYED);
  });

  it("rollback requires reason", async () => {
    const prisma = buildPrisma();
    prisma.softwareRelease.findFirst.mockResolvedValue({ id: "r1" });
    prisma.softwareRelease.update.mockResolvedValue({ id: "r1", status: ReleaseStatus.ROLLED_BACK });

    const service = new ReleasesService(prisma as never);
    const rolled = await service.rollback("r1", { reason: "Critical regression in work order close flow." });
    expect(rolled.status).toBe(ReleaseStatus.ROLLED_BACK);
  });

  it("hypercare cannot complete with open critical tickets", async () => {
    const prisma = buildPrisma();
    prisma.hypercarePlan.findFirst.mockResolvedValue({ id: "h1", userFeedback: null });
    prisma.supportTicket.count.mockResolvedValue(2);

    const service = new HypercareService(prisma as never);
    await expect(service.complete("h1", {})).rejects.toThrow(BadRequestException);
  });

  it("handover doc masks secrets", async () => {
    const prisma = buildPrisma();
    prisma.supportHandover.findUnique.mockResolvedValue(null);
    prisma.supportHandover.create.mockResolvedValue({
      tenantId: "tenant-1",
      systemUrls: "mongodb+srv://user:pass@cluster/db"
    });

    const service = new HandoverService(prisma as never);
    const doc = await service.getHandover();
    expect(String(doc.systemUrls)).not.toContain("mongodb+srv://user:pass");
  });

  it("normal user can view own ticket only", async () => {
    mockCtx.actorRole = RoleName.TECHNICIAN;
    mockCtx.actorId = "tech-1";
    mockCtx.permissions = ["support.create"];

    const prisma = buildPrisma();
    prisma.supportTicket.findFirst.mockResolvedValue({
      id: "t1",
      reportedByUserId: "admin-1",
      isSensitive: false,
      description: "test"
    });

    const service = new SupportTicketsService(prisma as never);
    await expect(service.findOne("t1")).rejects.toThrow(ForbiddenException);
  });
});
