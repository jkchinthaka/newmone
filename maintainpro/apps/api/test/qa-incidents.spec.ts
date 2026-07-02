import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import {
  QaEnvironment,
  QaIssueCategory,
  QaIssueSeverity,
  QaIssueStatus,
  QaRegressionResult,
  QaRootCauseType,
  RoleName
} from "@prisma/client";

import { QaIssuesService } from "../src/modules/qa/qa-issues.service";
import { QA_CATEGORY_CATALOG } from "../src/modules/qa/qa.constants";

const mockCtx: {
  actorId: string;
  actorRole: RoleName;
  tenantId: string;
  permissions: string[];
} = {
  actorId: "admin-1",
  actorRole: RoleName.ADMIN,
  tenantId: "tenant-1",
  permissions: ["qa.manage", "qa.view", "qa.export", "qa.accept_risk"]
};

jest.mock("../src/common/context/request-context", () => ({
  requestContext: {
    get: jest.fn(() => mockCtx)
  }
}));

const ALL_CATEGORIES: QaIssueCategory[] = [
  "REQUIREMENT_ERROR",
  "UI_UX_ERROR",
  "FRONTEND_ERROR",
  "BACKEND_ERROR",
  "DATABASE_ERROR",
  "AUTH_RBAC_ERROR",
  "API_INTEGRATION_ERROR",
  "DEPLOYMENT_ERROR",
  "PERFORMANCE_ERROR",
  "SECURITY_ERROR",
  "DATA_QUALITY_ERROR",
  "TESTING_QA_ERROR"
];

const buildIssue = (overrides: Record<string, unknown> = {}) => ({
  id: "issue-1",
  tenantId: "tenant-1",
  issueNo: "QA-0001",
  title: "Sample issue",
  description: "Detailed description of the issue for testing.",
  category: "BACKEND_ERROR" as QaIssueCategory,
  subCategory: null,
  severity: QaIssueSeverity.MEDIUM,
  priority: "MEDIUM",
  status: QaIssueStatus.REPORTED,
  affectedModule: "Work Orders",
  affectedPage: null,
  affectedApi: null,
  environment: QaEnvironment.STAGING,
  reportedByUserId: "admin-1",
  assignedToUserId: null,
  ownerDepartment: null,
  businessImpact: null,
  userImpact: null,
  reproductionSteps: "Step one then step two",
  expectedResult: "Should work",
  actualResult: "Failed",
  rootCause: null,
  fixSummary: null,
  workaround: null,
  regressionRisk: null,
  linkedCommitHash: null,
  linkedDeployId: null,
  linkedUatPhase: "UAT-025",
  linkedWorkOrderId: null,
  isSensitive: false,
  regressionRequired: false,
  regressionResult: null,
  resolutionNote: null,
  knownLimitation: null,
  futureFixPlan: null,
  acceptedRiskByUserId: null,
  acceptedRiskAt: null,
  riskReviewDate: null,
  firstDetectedAt: new Date(),
  fixedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  rcaRecords: [],
  regressionTests: [],
  ...overrides
});

const buildPrisma = () => {
  const prisma: Record<string, any> = {
    qaIssue: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn()
    },
    qaIssueRca: {
      create: jest.fn()
    },
    qaRegressionTest: {
      create: jest.fn()
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: "audit-1" })
    }
  };
  return prisma;
};

describe("QaIssuesService (UAT-025)", () => {
  beforeEach(() => {
    mockCtx.actorId = "admin-1";
    mockCtx.actorRole = RoleName.ADMIN;
    mockCtx.tenantId = "tenant-1";
    mockCtx.permissions = ["qa.manage", "qa.view", "qa.export", "qa.accept_risk"];
  });

  it("exposes all 12 error categories", () => {
    const service = new QaIssuesService(buildPrisma() as never);
    const categories = service.getCategories();
    expect(categories).toHaveLength(12);
    expect(categories.map((c) => c.key).sort()).toEqual([...ALL_CATEGORIES].sort());
    expect(QA_CATEGORY_CATALOG.every((c) => c.label && c.description && c.examples.length > 0)).toBe(true);
  });

  it.each(ALL_CATEGORIES)("creates %s issue", async (category) => {
    const prisma = buildPrisma();
    prisma.qaIssue.count.mockResolvedValue(0);
    prisma.qaIssue.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(buildIssue({ id: `issue-${category}`, category: data.category, issueNo: "QA-0001" }))
    );

    const service = new QaIssuesService(prisma as never);
    const result = await service.create({
      title: `${category} sample`,
      description: "Detailed issue description for category validation testing.",
      category,
      severity: QaIssueSeverity.MEDIUM,
      affectedModule: "QA Module"
    });

    expect(result.category).toBe(category);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("status change writes audit trail", async () => {
    const prisma = buildPrisma();
    const existing = buildIssue({ status: QaIssueStatus.TRIAGED });
    prisma.qaIssue.findFirst.mockResolvedValue(existing);
    prisma.qaIssue.update.mockResolvedValue(buildIssue({ status: QaIssueStatus.IN_PROGRESS }));

    const service = new QaIssuesService(prisma as never);
    await service.changeStatus("issue-1", {
      status: QaIssueStatus.IN_PROGRESS,
      reason: "Developer started work"
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "qa_issue_status_changed" })
        })
      })
    );
  });

  it("severity change requires reason", async () => {
    const prisma = buildPrisma();
    prisma.qaIssue.findFirst.mockResolvedValue(buildIssue({ severity: QaIssueSeverity.LOW }));

    const service = new QaIssuesService(prisma as never);
    await expect(service.update("issue-1", { severity: QaIssueSeverity.HIGH })).rejects.toThrow(
      BadRequestException
    );
  });

  it("critical issue requires RCA before close", async () => {
    const prisma = buildPrisma();
    prisma.qaIssue.findFirst.mockResolvedValue(
      buildIssue({
        severity: QaIssueSeverity.CRITICAL,
        environment: QaEnvironment.PRODUCTION,
        regressionRequired: true,
        rcaRecords: [],
        regressionTests: []
      })
    );

    const service = new QaIssuesService(prisma as never);
    await expect(
      service.close("issue-1", { resolutionNote: "Attempted close without RCA and regression." })
    ).rejects.toThrow(BadRequestException);
  });

  it("regression failure reopens issue", async () => {
    const prisma = buildPrisma();
    const existing = buildIssue({ status: QaIssueStatus.RETESTING });
    prisma.qaIssue.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(buildIssue({ status: QaIssueStatus.REOPENED, regressionResult: "FAIL" }));
    prisma.qaRegressionTest.create.mockResolvedValue({ id: "reg-1" });
    prisma.qaIssue.update.mockResolvedValue(buildIssue({ status: QaIssueStatus.REOPENED }));

    const service = new QaIssuesService(prisma as never);
    await service.addRegressionTest("issue-1", {
      testCase: "Verify login after fix",
      environment: QaEnvironment.STAGING,
      result: QaRegressionResult.FAIL,
      notes: "Still failing on mobile"
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "qa_issue_reopened" })
        })
      })
    );
  });

  it("accepted risk requires manager or admin approval", async () => {
    mockCtx.actorRole = RoleName.TECHNICIAN;
    mockCtx.permissions = ["qa.create", "qa.view"];

    const prisma = buildPrisma();
    prisma.qaIssue.findFirst.mockResolvedValue(buildIssue());

    const service = new QaIssuesService(prisma as never);
    await expect(
      service.acceptRisk("issue-1", {
        reason: "Business accepts temporary workaround for pilot rollout."
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows manager to accept risk", async () => {
    mockCtx.actorRole = RoleName.MANAGER;
    mockCtx.permissions = ["qa.view", "qa.accept_risk"];

    const prisma = buildPrisma();
    prisma.qaIssue.findFirst.mockResolvedValue(buildIssue());
    prisma.qaIssue.update.mockResolvedValue(
      buildIssue({ status: QaIssueStatus.ACCEPTED_RISK, acceptedRiskByUserId: "mgr-1" })
    );

    const service = new QaIssuesService(prisma as never);
    const result = await service.acceptRisk("issue-1", {
      reason: "Known limitation accepted for department pilot.",
      knownLimitation: "Report export delayed up to 5 minutes"
    });

    expect(result.status).toBe(QaIssueStatus.ACCEPTED_RISK);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "qa_issue_risk_accepted" })
        })
      })
    );
  });

  it("blocks unauthorized user from viewing sensitive security issue", async () => {
    mockCtx.actorId = "tech-1";
    mockCtx.actorRole = RoleName.TECHNICIAN;
    mockCtx.permissions = ["qa.create", "qa.view"];

    const prisma = buildPrisma();
    prisma.qaIssue.findFirst.mockResolvedValue(
      buildIssue({
        reportedByUserId: "admin-1",
        category: "SECURITY_ERROR",
        isSensitive: true
      })
    );

    const service = new QaIssuesService(prisma as never);
    await expect(service.findOne("issue-1")).rejects.toThrow(ForbiddenException);
  });

  it("report export writes audit event", async () => {
    const prisma = buildPrisma();
    prisma.qaIssue.findMany.mockResolvedValue([
      buildIssue({ severity: QaIssueSeverity.LOW, status: QaIssueStatus.CLOSED })
    ]);
    prisma.qaIssue.count.mockResolvedValue(1);
    prisma.qaIssue.groupBy.mockResolvedValue([]);

    const service = new QaIssuesService(prisma as never);
    const report = await service.exportReport({ uatPhase: "UAT-025" });

    expect(report.verdict).toBeDefined();
    expect(report.exportedAt).toBeDefined();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "qa_report_exported" })
        })
      })
    );
  });

  it("dashboard returns tenant counts for QA managers", async () => {
    const prisma = buildPrisma();
    prisma.qaIssue.count.mockResolvedValue(2);
    prisma.qaIssue.groupBy.mockResolvedValue([{ category: "BACKEND_ERROR", _count: 2 }]);

    const service = new QaIssuesService(prisma as never);
    const dashboard = await service.getDashboard();

    expect(dashboard.scope).toBe("tenant");
    expect(dashboard.openCritical).toBe(2);
    expect(dashboard.uatPhases).toContain("UAT-025");
  });

  it("adds RCA and allows closing critical issue after pass regression", async () => {
    const prisma = buildPrisma();
    const critical = buildIssue({
      severity: QaIssueSeverity.CRITICAL,
      environment: QaEnvironment.PRODUCTION,
      regressionRequired: true,
      status: QaIssueStatus.PASSED,
      rcaRecords: [],
      regressionTests: [{ result: QaRegressionResult.PASS }]
    });

    prisma.qaIssue.findFirst
      .mockResolvedValueOnce(critical)
      .mockResolvedValueOnce({
        ...critical,
        rcaRecords: [{ id: "rca-1" }],
        regressionTests: [{ result: QaRegressionResult.PASS }]
      })
      .mockResolvedValueOnce({
        ...critical,
        rcaRecords: [{ id: "rca-1" }],
        regressionTests: [{ result: QaRegressionResult.PASS }]
      });
    prisma.qaIssueRca.create.mockResolvedValue({ id: "rca-1" });
    prisma.qaIssue.update.mockResolvedValue(buildIssue({ status: QaIssueStatus.CLOSED }));

    const service = new QaIssuesService(prisma as never);
    await service.addRca("issue-1", {
      rootCauseType: QaRootCauseType.CODING_BUG,
      explanation: "Null guard missing in work order status transition handler."
    });

    const closed = await service.close("issue-1", {
      resolutionNote: "Added null guard and deployed hotfix to production."
    });

    expect(closed.status).toBe(QaIssueStatus.CLOSED);
  });

  it("returns not found for missing issue", async () => {
    const prisma = buildPrisma();
    prisma.qaIssue.findFirst.mockResolvedValue(null);

    const service = new QaIssuesService(prisma as never);
    await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
  });
});
