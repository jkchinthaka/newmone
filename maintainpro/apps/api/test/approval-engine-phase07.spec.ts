import { BadRequestException } from "@nestjs/common";
import {
  ApprovalDecisionOutcome,
  ApprovalProcessType,
  ApprovalTrigger,
  Priority,
  RoleName
} from "@prisma/client";

import {
  ApprovalConditionField,
  ApprovalConditionOperator,
  conditionsMatch,
  gateOverrideApprovalHook,
  parseConditions,
  ruleScopeMatches
} from "../src/modules/approvals/approval-conditions";

describe("Phase 7 approval conditions", () => {
  it("parses structured conditions and rejects unknown fields", () => {
    expect(
      parseConditions([
        { field: ApprovalConditionField.PRIORITY, operator: ApprovalConditionOperator.EQ, value: "CRITICAL" }
      ])
    ).toHaveLength(1);
    expect(() => parseConditions([{ field: "HACK", operator: "EQ", value: 1 }])).toThrow(BadRequestException);
  });

  it("matches priority and threshold scope", () => {
    expect(
      conditionsMatch(
        [{ field: ApprovalConditionField.PRIORITY, operator: ApprovalConditionOperator.EQ, value: "CRITICAL" }],
        { processType: ApprovalProcessType.CRITICAL_WORK_ORDER, priority: Priority.CRITICAL }
      )
    ).toBe(true);

    expect(
      ruleScopeMatches(
        { amountThreshold: 10000, amountField: "estimatedCost", priorityScope: ["CRITICAL"] },
        {
          processType: ApprovalProcessType.HIGH_COST_WORK_ORDER,
          priority: Priority.CRITICAL,
          estimatedCost: 15000
        }
      )
    ).toBe(true);

    expect(
      ruleScopeMatches(
        { amountThreshold: 10000, amountField: "estimatedCost" },
        { processType: ApprovalProcessType.HIGH_COST_WORK_ORDER, estimatedCost: 5000 }
      )
    ).toBe(false);
  });

  it("matches site / department / domain scopes", () => {
    expect(
      ruleScopeMatches(
        { siteId: "s1", departmentId: "d1", domainId: "dom1" },
        {
          processType: ApprovalProcessType.VENDOR_REPAIR,
          siteId: "s1",
          departmentId: "d1",
          domainId: "dom1"
        }
      )
    ).toBe(true);
    expect(
      ruleScopeMatches({ siteId: "s1" }, { processType: ApprovalProcessType.VENDOR_REPAIR, siteId: "s2" })
    ).toBe(false);
  });

  it("exposes gate override hook without building fleet engine", () => {
    const hook = gateOverrideApprovalHook();
    expect(hook.processType).toBe(ApprovalProcessType.GATE_OVERRIDE);
    expect(hook.trigger).toBe(ApprovalTrigger.BEFORE_GATE_OVERRIDE);
  });
});

describe("Phase 7 ApprovalsService behaviors (unit with mocks)", () => {
  const prisma: any = {
    approvalRule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    approvalRequest: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    },
    approvalStep: { update: jest.fn() },
    approvalDecision: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    user: { findFirst: jest.fn() },
    workOrder: { updateMany: jest.fn() },
    asset: { updateMany: jest.fn() },
    $transaction: jest.fn(async (fn: any) => {
      if (typeof fn === "function") {
        return fn({
          approvalRule: prisma.approvalRule,
          approvalRequest: {
            update: jest.fn(),
            create: prisma.approvalRequest.create
          },
          approvalStep: prisma.approvalStep,
          approvalDecision: prisma.approvalDecision
        });
      }
      return Promise.all(fn);
    })
  };

  const notifications = {
    createNotification: jest.fn().mockResolvedValue(null)
  };

  // Lazy require after mocks — service imports Prisma enums at load time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ApprovalsService } = require("../src/modules/approvals/approvals.service");

  const service = new ApprovalsService(prisma, notifications);
  const actor = {
    sub: "user-req",
    role: RoleName.ADMIN,
    tenantId: "tenant-1",
    permissions: ["approvals.rule.manage", "approvals.decide", "approvals.override.emergency"]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fails safely when no approver can be resolved", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(null);
    prisma.approvalRule.findMany.mockResolvedValue([
      {
        id: "rule-1",
        tenantId: "tenant-1",
        version: 1,
        name: "Critical",
        processType: ApprovalProcessType.CRITICAL_WORK_ORDER,
        trigger: ApprovalTrigger.BEFORE_START,
        conditions: [],
        priorityScope: ["CRITICAL"],
        workTypeScope: [],
        amountThreshold: null,
        amountField: null,
        siteId: null,
        departmentId: null,
        domainId: null,
        slaHours: 4,
        emergencyOverrideAllowed: true,
        levels: [{ level: 1, approverRole: RoleName.MANAGER, approverUserId: null, backupUserId: null }]
      }
    ]);
    prisma.user.findFirst.mockResolvedValue(null);

    const result = await service.ensureApprovalRequired({
      actor,
      processType: ApprovalProcessType.CRITICAL_WORK_ORDER,
      trigger: ApprovalTrigger.BEFORE_START,
      subjectEntityType: "WorkOrder",
      subjectEntityId: "wo-1",
      context: {
        processType: ApprovalProcessType.CRITICAL_WORK_ORDER,
        priority: Priority.CRITICAL
      }
    });

    expect(result.required).toBe(true);
    expect(result.configError).toMatch(/No approver resolved/);
    expect(prisma.approvalRequest.create).not.toHaveBeenCalled();
  });

  it("creates multi-level request and preserves rule version snapshot", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(null);
    prisma.approvalRule.findMany.mockResolvedValue([
      {
        id: "rule-2",
        tenantId: "tenant-1",
        version: 3,
        name: "High cost",
        processType: ApprovalProcessType.HIGH_COST_WORK_ORDER,
        trigger: ApprovalTrigger.BEFORE_START,
        conditions: [],
        priorityScope: [],
        workTypeScope: [],
        amountThreshold: 1000,
        amountField: "estimatedCost",
        siteId: null,
        departmentId: null,
        domainId: null,
        slaHours: 8,
        emergencyOverrideAllowed: false,
        levels: [
          { level: 1, approverRole: RoleName.MANAGER, approverUserId: null, backupUserId: "backup-1" },
          { level: 2, approverRole: null, approverUserId: "exec-1", backupUserId: null }
        ]
      }
    ]);
    prisma.user.findFirst
      .mockResolvedValueOnce({ id: "mgr-1" })
      .mockResolvedValueOnce({ id: "backup-1" });
    prisma.approvalRequest.create.mockResolvedValue({
      id: "ar-1",
      status: "PENDING",
      triggeredRuleId: "rule-2",
      triggeredRuleVersion: 3,
      steps: [{ id: "s1", level: 1, assignedApproverId: "mgr-1", dueAt: new Date() }]
    });
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.ensureApprovalRequired({
      actor,
      processType: ApprovalProcessType.HIGH_COST_WORK_ORDER,
      trigger: ApprovalTrigger.BEFORE_START,
      subjectEntityType: "WorkOrder",
      subjectEntityId: "wo-2",
      context: {
        processType: ApprovalProcessType.HIGH_COST_WORK_ORDER,
        estimatedCost: 5000
      }
    });

    expect(result.required).toBe(true);
    expect(result.matchedRuleVersion).toBe(3);
    expect(prisma.approvalRequest.create).toHaveBeenCalled();
    const createArg = prisma.approvalRequest.create.mock.calls[0][0];
    expect(createArg.data.triggeredRuleVersion).toBe(3);
    expect(createArg.data.ruleSnapshot.version).toBe(3);
    expect(createArg.data.steps.create).toHaveLength(2);
  });

  it("requires rejection reason", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: "ar-2",
      tenantId: "tenant-1",
      status: "PENDING",
      processType: ApprovalProcessType.WORK_ORDER_REOPEN,
      subjectEntityType: "WorkOrder",
      subjectEntityId: "wo-3",
      requesterId: "user-req",
      steps: [
        {
          id: "step-1",
          level: 1,
          status: "PENDING",
          assignedApproverId: actor.sub,
          backupApproverId: null
        }
      ],
      decisions: [],
      requester: {},
      triggeredRule: { id: "r", name: "reopen", version: 1, processType: "WORK_ORDER_REOPEN" }
    });

    await expect(
      service.decide({
        actor,
        requestId: "ar-2",
        decision: ApprovalDecisionOutcome.REJECTED,
        reason: ""
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("derives overdue from dueAt without status explosion", () => {
    expect(
      service.isStepOverdue({
        dueAt: new Date(Date.now() - 60_000),
        status: "PENDING"
      })
    ).toBe(true);
    expect(
      service.isStepOverdue({
        dueAt: new Date(Date.now() + 60_000),
        status: "PENDING"
      })
    ).toBe(false);
  });

  it("applies emergency override without erasing approval requirement", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: "ar-3",
      tenantId: "tenant-1",
      status: "PENDING",
      requesterId: "user-req",
      triggeredRule: { emergencyOverrideAllowed: true }
    });
    prisma.approvalRequest.update.mockResolvedValue({
      id: "ar-3",
      status: "EMERGENCY_OVERRIDE_PENDING_REVIEW"
    });
    prisma.auditLog.create.mockResolvedValue({});

    const updated = await service.applyEmergencyOverride({
      actor,
      approvalRequestId: "ar-3",
      reason: "Critical production stoppage"
    });

    expect(updated.status).toBe("EMERGENCY_OVERRIDE_PENDING_REVIEW");
    expect(prisma.approvalRequest.update).toHaveBeenCalled();
  });
});
