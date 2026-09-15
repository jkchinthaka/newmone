import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ApprovalDecisionOutcome,
  ApprovalProcessType,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  ApprovalTrigger,
  AuditAction,
  NotificationPriority,
  NotificationType,
  Prisma,
  RoleName
} from "@prisma/client";

import { stringArrayToText, toStringArray } from "../../common/utils/json-text";
import { PrismaService } from "../../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  ApprovalEvaluationContext,
  conditionsMatch,
  parseConditions,
  ruleScopeMatches,
  StructuredCondition
} from "./approval-conditions";

type Actor = {
  sub: string;
  role?: string;
  tenantId?: string | null;
  permissions?: string[];
};

export type RuleLevelInput = {
  level: number;
  approverRole?: RoleName | string | null;
  approverUserId?: string | null;
  backupUserId?: string | null;
};

export type CreateRuleInput = {
  name: string;
  processType: ApprovalProcessType;
  trigger: ApprovalTrigger;
  conditions?: unknown;
  siteId?: string | null;
  departmentId?: string | null;
  domainId?: string | null;
  priorityScope?: string[];
  workTypeScope?: string[];
  amountThreshold?: number | null;
  amountField?: string | null;
  slaHours?: number | null;
  escalateToBackup?: boolean;
  emergencyOverrideAllowed?: boolean;
  effectiveFrom?: string | Date | null;
  effectiveTo?: string | Date | null;
  levels: RuleLevelInput[];
};

export type EnsureApprovalResult = {
  required: boolean;
  matchedRuleId?: string;
  matchedRuleVersion?: number;
  approvalRequestId?: string | null;
  status?: ApprovalRequestStatus | null;
  /** True when requester may proceed despite pending post-review */
  emergencyOverrideActive?: boolean;
  configError?: string;
};

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  private async notifySafe(
    input: Parameters<NotificationsService["createNotification"]>[0]
  ) {
    try {
      await this.notifications.createNotification(input);
    } catch {
      // Notification failure must not block approval control path.
    }
  }

  private requireTenantId(actor?: Actor) {
    const tenantId = actor?.tenantId;
    if (!tenantId) throw new BadRequestException("Tenant context is required");
    return tenantId;
  }

  private async audit(input: {
    tenantId: string;
    actorId: string;
    entity: string;
    entityId: string;
    action: AuditAction;
    beforeData?: Prisma.InputJsonValue;
    afterData?: Prisma.InputJsonValue;
    reason?: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        beforeData: input.beforeData,
        afterData: input.afterData,
        reason: input.reason
      }
    });
  }

  async listRules(actor: Actor, query?: { processType?: ApprovalProcessType; activeOnly?: boolean }) {
    const tenantId = this.requireTenantId(actor);
    return this.prisma.approvalRule.findMany({
      where: {
        tenantId,
        ...(query?.processType ? { processType: query.processType } : {}),
        ...(query?.activeOnly ? { isActive: true } : {})
      },
      include: { levels: { orderBy: { level: "asc" } } },
      orderBy: [{ processType: "asc" }, { ruleFamilyKey: "asc" }, { version: "desc" }]
    });
  }

  async getRule(id: string, actor: Actor) {
    const tenantId = this.requireTenantId(actor);
    const rule = await this.prisma.approvalRule.findFirst({
      where: { id, tenantId },
      include: { levels: { orderBy: { level: "asc" } } }
    });
    if (!rule) throw new NotFoundException("Approval rule not found");
    return rule;
  }

  private validateLevels(levels: RuleLevelInput[]) {
    if (!levels?.length) {
      throw new BadRequestException("At least one approval level is required");
    }
    const seen = new Set<number>();
    for (const level of levels) {
      if (!Number.isInteger(level.level) || level.level < 1) {
        throw new BadRequestException("Approval level must be a positive integer");
      }
      if (seen.has(level.level)) {
        throw new BadRequestException(`Duplicate approval level ${level.level}`);
      }
      seen.add(level.level);
      if (!level.approverRole && !level.approverUserId) {
        throw new BadRequestException(
          `Level ${level.level} must specify approverRole or approverUserId`
        );
      }
    }
  }

  async createRule(input: CreateRuleInput, actor: Actor) {
    const tenantId = this.requireTenantId(actor);
    const conditions = parseConditions(input.conditions ?? []);
    this.validateLevels(input.levels);

    const created = await this.prisma.approvalRule.create({
      data: {
        tenantId,
        name: input.name.trim(),
        processType: input.processType,
        trigger: input.trigger,
        conditions: conditions as unknown as Prisma.InputJsonValue,
        siteId: input.siteId ?? undefined,
        departmentId: input.departmentId ?? undefined,
        domainId: input.domainId ?? undefined,
        priorityScope: stringArrayToText(input.priorityScope ?? []),
        workTypeScope: stringArrayToText(input.workTypeScope ?? []),
        amountThreshold: input.amountThreshold ?? undefined,
        amountField: input.amountField ?? undefined,
        slaHours: input.slaHours ?? undefined,
        escalateToBackup: input.escalateToBackup ?? true,
        emergencyOverrideAllowed: input.emergencyOverrideAllowed ?? false,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
        version: 1,
        ruleFamilyKey: `tmp-${Date.now()}`,
        isActive: true,
        createdById: actor.sub,
        updatedById: actor.sub,
        levels: {
          create: input.levels.map((l) => ({
            tenantId,
            level: l.level,
            approverRole: l.approverRole ?? undefined,
            approverUserId: l.approverUserId ?? undefined,
            backupUserId: l.backupUserId ?? undefined
          }))
        }
      },
      include: { levels: { orderBy: { level: "asc" } } }
    });

    // Family key equals first version id so versions share a stable identity.
    const withFamily = await this.prisma.approvalRule.update({
      where: { id: created.id },
      data: { ruleFamilyKey: created.id },
      include: { levels: { orderBy: { level: "asc" } } }
    });

    await this.audit({
      tenantId,
      actorId: actor.sub,
      entity: "ApprovalRule",
      entityId: withFamily.id,
      action: AuditAction.CREATE,
      afterData: {
        name: withFamily.name,
        processType: withFamily.processType,
        version: withFamily.version
      } as Prisma.InputJsonValue
    });

    return withFamily;
  }

  /**
   * Edits create a new version and deactivate the prior active version in the family.
   * Existing ApprovalRequests keep triggeredRuleId + ruleSnapshot â€” never rewritten.
   */
  async updateRuleVersion(ruleId: string, input: CreateRuleInput, actor: Actor) {
    const tenantId = this.requireTenantId(actor);
    const current = await this.getRule(ruleId, actor);
    const conditions = parseConditions(input.conditions ?? []);
    this.validateLevels(input.levels);

    const nextVersion = current.version + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.approvalRule.update({
        where: { id: current.id },
        data: {
          isActive: false,
          effectiveTo: new Date(),
          updatedById: actor.sub
        }
      });

      return tx.approvalRule.create({
        data: {
          tenantId,
          name: input.name.trim(),
          processType: input.processType,
          trigger: input.trigger,
          conditions: conditions as unknown as Prisma.InputJsonValue,
          siteId: input.siteId ?? undefined,
          departmentId: input.departmentId ?? undefined,
          domainId: input.domainId ?? undefined,
          priorityScope: stringArrayToText(input.priorityScope ?? []),
          workTypeScope: stringArrayToText(input.workTypeScope ?? []),
          amountThreshold: input.amountThreshold ?? undefined,
          amountField: input.amountField ?? undefined,
          slaHours: input.slaHours ?? undefined,
          escalateToBackup: input.escalateToBackup ?? true,
          emergencyOverrideAllowed: input.emergencyOverrideAllowed ?? false,
          effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
          effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
          version: nextVersion,
          ruleFamilyKey: current.ruleFamilyKey,
          isActive: true,
          createdById: actor.sub,
          updatedById: actor.sub,
          levels: {
            create: input.levels.map((l) => ({
              tenantId,
              level: l.level,
              approverRole: l.approverRole ?? undefined,
              approverUserId: l.approverUserId ?? undefined,
              backupUserId: l.backupUserId ?? undefined
            }))
          }
        },
        include: { levels: { orderBy: { level: "asc" } } }
      });
    });

    await this.audit({
      tenantId,
      actorId: actor.sub,
      entity: "ApprovalRule",
      entityId: created.id,
      action: AuditAction.UPDATE,
      reason: "Approval rule versioned",
      beforeData: { id: current.id, version: current.version, isActive: true } as Prisma.InputJsonValue,
      afterData: { id: created.id, version: created.version, isActive: true } as Prisma.InputJsonValue
    });

    return created;
  }

  async deactivateRule(ruleId: string, actor: Actor) {
    const tenantId = this.requireTenantId(actor);
    const current = await this.getRule(ruleId, actor);
    if (!current.isActive) return current;

    const updated = await this.prisma.approvalRule.update({
      where: { id: ruleId },
      data: {
        isActive: false,
        effectiveTo: new Date(),
        updatedById: actor.sub
      },
      include: { levels: { orderBy: { level: "asc" } } }
    });

    await this.audit({
      tenantId,
      actorId: actor.sub,
      entity: "ApprovalRule",
      entityId: ruleId,
      action: AuditAction.UPDATE,
      reason: "Approval rule deactivated",
      beforeData: { isActive: true } as Prisma.InputJsonValue,
      afterData: { isActive: false } as Prisma.InputJsonValue
    });

    return updated;
  }

  previewImpact(rule: {
    processType: ApprovalProcessType;
    trigger: ApprovalTrigger;
    siteId?: string | null;
    departmentId?: string | null;
    domainId?: string | null;
    priorityScope?: string[];
    workTypeScope?: string[];
    amountThreshold?: number | null;
    amountField?: string | null;
    levels?: Array<{ level: number; approverRole?: RoleName | string | null; approverUserId?: string | null }>;
    effectiveFrom?: Date | string | null;
    conditions?: unknown;
  }) {
    return {
      processType: rule.processType,
      trigger: rule.trigger,
      scope: {
        siteId: rule.siteId ?? null,
        departmentId: rule.departmentId ?? null,
        domainId: rule.domainId ?? null,
        priorityScope: toStringArray(rule.priorityScope),
        workTypeScope: toStringArray(rule.workTypeScope),
        amountThreshold: rule.amountThreshold ?? null,
        amountField: rule.amountField ?? null
      },
      conditions: parseConditions(rule.conditions ?? []),
      levels: (rule.levels ?? []).map((l) => ({
        level: l.level,
        approverRole: l.approverRole ?? null,
        approverUserId: l.approverUserId ?? null
      })),
      effectiveFrom: rule.effectiveFrom ?? null
    };
  }

  async simulate(actor: Actor, ctx: ApprovalEvaluationContext & { trigger?: ApprovalTrigger }) {
    const match = await this.findMatchingRule(actor, ctx);
    if (!match) {
      return { matched: false, message: "No active approval rule matches the simulated context" };
    }
    const resolution = await this.resolveLevels(match, actor.tenantId!);
    return {
      matched: true,
      rule: {
        id: match.id,
        name: match.name,
        version: match.version,
        processType: match.processType,
        trigger: match.trigger,
        amountThreshold: match.amountThreshold
      },
      levels: resolution.levels,
      configError: resolution.configError
    };
  }

  async findMatchingRule(actor: Actor, ctx: ApprovalEvaluationContext & { trigger?: ApprovalTrigger }) {
    const tenantId = this.requireTenantId(actor);
    const now = new Date();
    const candidates = await this.prisma.approvalRule.findMany({
      where: {
        tenantId,
        processType: ctx.processType,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        ...(ctx.trigger ? { trigger: ctx.trigger } : {})
      },
      include: { levels: { orderBy: { level: "asc" } } },
      orderBy: [{ version: "desc" }]
    });

    for (const rule of candidates) {
      if (!ruleScopeMatches(rule, ctx)) continue;
      const conditions = parseConditions(rule.conditions);
      if (!conditionsMatch(conditions, ctx)) continue;
      return rule;
    }
    return null;
  }

  /**
   * Never auto-approve when no user can be resolved â€” surface configuration error instead.
   */
  private async resolveLevels(
    rule: {
      id: string;
      tenantId: string;
      slaHours: number | null;
      levels: Array<{
        level: number;
        approverRole: RoleName | string | null;
        approverUserId: string | null;
        backupUserId: string | null;
      }>;
    },
    tenantId: string
  ): Promise<{
    levels: Array<{
      level: number;
      approverRole: RoleName | string | null;
      assignedApproverId: string | null;
      backupApproverId: string | null;
    }>;
    configError?: string;
  }> {
    const resolved: Array<{
      level: number;
      approverRole: RoleName | string | null;
      assignedApproverId: string | null;
      backupApproverId: string | null;
    }> = [];

    for (const level of rule.levels) {
      let assignedApproverId = level.approverUserId;
      if (!assignedApproverId && level.approverRole) {
        const user = await this.prisma.user.findFirst({
          where: {
            tenantId,
            isActive: true,
            role: { name: level.approverRole }
          },
          orderBy: { createdAt: "asc" },
          select: { id: true }
        });
        assignedApproverId = user?.id ?? null;
      }

      if (!assignedApproverId) {
        return {
          levels: [],
          configError: `No approver resolved for rule ${rule.id} level ${level.level}`
        };
      }

      if (level.backupUserId) {
        const backup = await this.prisma.user.findFirst({
          where: { id: level.backupUserId, tenantId, isActive: true },
          select: { id: true }
        });
        if (!backup) {
          return {
            levels: [],
            configError: `Backup approver missing for rule ${rule.id} level ${level.level}`
          };
        }
      }

      resolved.push({
        level: level.level,
        approverRole: level.approverRole,
        assignedApproverId,
        backupApproverId: level.backupUserId
      });
    }

    return { levels: resolved };
  }

  async findOpenRequest(tenantId: string, subjectEntityType: string, subjectEntityId: string) {
    return this.prisma.approvalRequest.findFirst({
      where: {
        tenantId,
        subjectEntityType,
        subjectEntityId,
        status: {
          in: [ApprovalRequestStatus.PENDING, ApprovalRequestStatus.EMERGENCY_OVERRIDE_PENDING_REVIEW]
        }
      },
      include: {
        steps: { orderBy: { level: "asc" } },
        decisions: { orderBy: { decidedAt: "asc" } }
      },
      orderBy: { requestedAt: "desc" }
    });
  }

  async findApprovedRequest(
    tenantId: string,
    processType: ApprovalProcessType,
    subjectEntityType: string,
    subjectEntityId: string
  ) {
    return this.prisma.approvalRequest.findFirst({
      where: {
        tenantId,
        processType,
        subjectEntityType,
        subjectEntityId,
        status: ApprovalRequestStatus.APPROVED
      },
      orderBy: { completedAt: "desc" }
    });
  }

  /**
   * Core integration entry: evaluate rules and create an ApprovalRequest when needed.
   * Idempotent for open requests on the same subject.
   */
  async ensureApprovalRequired(input: {
    actor: Actor;
    processType: ApprovalProcessType;
    trigger: ApprovalTrigger;
    subjectEntityType: string;
    subjectEntityId: string;
    context: ApprovalEvaluationContext;
    sourceContext?: Prisma.InputJsonValue;
  }): Promise<EnsureApprovalResult> {
    const tenantId = this.requireTenantId(input.actor);

    const approved = await this.findApprovedRequest(
      tenantId,
      input.processType,
      input.subjectEntityType,
      input.subjectEntityId
    );
    if (approved) {
      return {
        required: false,
        matchedRuleId: approved.triggeredRuleId,
        matchedRuleVersion: approved.triggeredRuleVersion,
        approvalRequestId: approved.id,
        status: approved.status
      };
    }

    const open = await this.findOpenRequest(tenantId, input.subjectEntityType, input.subjectEntityId);
    if (open && open.processType === input.processType) {
      return {
        required: true,
        matchedRuleId: open.triggeredRuleId,
        matchedRuleVersion: open.triggeredRuleVersion,
        approvalRequestId: open.id,
        status: open.status,
        emergencyOverrideActive:
          open.status === ApprovalRequestStatus.EMERGENCY_OVERRIDE_PENDING_REVIEW
      };
    }

    const rule = await this.findMatchingRule(input.actor, {
      ...input.context,
      processType: input.processType,
      trigger: input.trigger
    });

    if (!rule) {
      return { required: false };
    }

    const resolution = await this.resolveLevels(rule, tenantId);
    if (resolution.configError) {
      return {
        required: true,
        matchedRuleId: rule.id,
        matchedRuleVersion: rule.version,
        configError: resolution.configError
      };
    }

    const dueAt =
      rule.slaHours != null
        ? new Date(Date.now() + rule.slaHours * 60 * 60 * 1000)
        : null;

    const snapshot = {
      ruleId: rule.id,
      version: rule.version,
      name: rule.name,
      processType: rule.processType,
      trigger: rule.trigger,
      conditions: rule.conditions,
      amountThreshold: rule.amountThreshold,
      amountField: rule.amountField,
      siteId: rule.siteId,
      departmentId: rule.departmentId,
      domainId: rule.domainId,
      priorityScope: toStringArray(rule.priorityScope),
      workTypeScope: toStringArray(rule.workTypeScope),
      slaHours: rule.slaHours,
      emergencyOverrideAllowed: rule.emergencyOverrideAllowed,
      levels: resolution.levels
    };

    const created = await this.prisma.approvalRequest.create({
      data: {
        tenantId,
        processType: input.processType,
        subjectEntityType: input.subjectEntityType,
        subjectEntityId: input.subjectEntityId,
        triggeredRuleId: rule.id,
        triggeredRuleVersion: rule.version,
        ruleSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        sourceContext: input.sourceContext,
        requesterId: input.actor.sub,
        status: ApprovalRequestStatus.PENDING,
        steps: {
          create: resolution.levels.map((l, index) => ({
            tenantId,
            level: l.level,
            approverRole: l.approverRole ?? undefined,
            assignedApproverId: l.assignedApproverId ?? undefined,
            backupApproverId: l.backupApproverId ?? undefined,
            status: index === 0 ? ApprovalStepStatus.PENDING : ApprovalStepStatus.PENDING,
            dueAt: dueAt ?? undefined
          }))
        }
      },
      include: { steps: { orderBy: { level: "asc" } } }
    });

    await this.audit({
      tenantId,
      actorId: input.actor.sub,
      entity: "ApprovalRequest",
      entityId: created.id,
      action: AuditAction.CREATE,
      afterData: {
        processType: created.processType,
        subjectEntityType: created.subjectEntityType,
        subjectEntityId: created.subjectEntityId,
        triggeredRuleVersion: created.triggeredRuleVersion
      } as Prisma.InputJsonValue
    });

    const first = created.steps[0];
    if (first?.assignedApproverId) {
      await this.notifySafe({
        userId: first.assignedApproverId,
        title: "Approval required",
        message: `${input.processType} needs your approval`,
        type: NotificationType.APPROVAL_REQUIRED,
        priority: NotificationPriority.WARNING,
        referenceId: created.id,
        referenceType: "ApprovalRequest",
        dueAt: first.dueAt,
        dedupeKey: `approval-req-${created.id}-L${first.level}`
      });
    }

    return {
      required: true,
      matchedRuleId: rule.id,
      matchedRuleVersion: rule.version,
      approvalRequestId: created.id,
      status: created.status
    };
  }

  async applyEmergencyOverride(input: {
    actor: Actor;
    approvalRequestId: string;
    reason: string;
  }) {
    const tenantId = this.requireTenantId(input.actor);
    const reason = input.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException("Emergency override reason is required");
    }

    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: input.approvalRequestId, tenantId },
      include: { triggeredRule: true }
    });
    if (!request) throw new NotFoundException("Approval request not found");
    if (request.status !== ApprovalRequestStatus.PENDING) {
      throw new BadRequestException("Emergency override only applies to pending approvals");
    }
    if (!request.triggeredRule.emergencyOverrideAllowed) {
      throw new ForbiddenException("Emergency override is not allowed for this rule");
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: ApprovalRequestStatus.EMERGENCY_OVERRIDE_PENDING_REVIEW,
        emergencyOverrideAt: new Date(),
        emergencyOverrideById: input.actor.sub,
        emergencyOverrideReason: reason
      }
    });

    await this.audit({
      tenantId,
      actorId: input.actor.sub,
      entity: "ApprovalRequest",
      entityId: request.id,
      action: AuditAction.UPDATE,
      reason,
      beforeData: { status: request.status } as Prisma.InputJsonValue,
      afterData: {
        status: updated.status,
        emergencyOverride: true
      } as Prisma.InputJsonValue
    });

    await this.notifySafe({
      userId: request.requesterId,
      title: "Emergency override recorded",
      message: "Post-approval review is still required",
      type: NotificationType.APPROVAL_EMERGENCY_OVERRIDE,
      priority: NotificationPriority.CRITICAL,
      referenceId: request.id,
      referenceType: "ApprovalRequest"
    });

    return updated;
  }

  isStepOverdue(step: { dueAt: Date | null; status: ApprovalStepStatus }) {
    return (
      step.status === ApprovalStepStatus.PENDING &&
      step.dueAt != null &&
      step.dueAt.getTime() < Date.now()
    );
  }

  async escalateOverdueSteps(actor: Actor, requestId: string) {
    const tenantId = this.requireTenantId(actor);
    const request = await this.getRequest(requestId, actor);
    const pending = request.steps.filter((s) => s.status === ApprovalStepStatus.PENDING);
    const updates = [];

    for (const step of pending) {
      if (!this.isStepOverdue(step)) continue;
      if (!step.backupApproverId) continue;

      const updated = await this.prisma.approvalStep.update({
        where: { id: step.id },
        data: {
          status: ApprovalStepStatus.ESCALATED,
          escalatedAt: new Date(),
          escalationState: "BACKUP_ACTIVATED",
          assignedApproverId: step.backupApproverId
        }
      });
      updates.push(updated);

      await this.notifySafe({
        userId: step.backupApproverId,
        title: "Approval escalated",
        message: "An overdue approval was escalated to you as backup",
        type: NotificationType.APPROVAL_ESCALATED,
        priority: NotificationPriority.CRITICAL,
        referenceId: request.id,
        referenceType: "ApprovalRequest",
        dedupeKey: `approval-esc-${step.id}`
      });

      await this.audit({
        tenantId,
        actorId: actor.sub,
        entity: "ApprovalStep",
        entityId: step.id,
        action: AuditAction.UPDATE,
        reason: "SLA overdue escalation",
        afterData: { escalationState: "BACKUP_ACTIVATED" } as Prisma.InputJsonValue
      });
    }

    return { escalated: updates.length, steps: updates };
  }

  async listInbox(
    actor: Actor,
    query?: { status?: ApprovalRequestStatus; page?: number; pageSize?: number }
  ) {
    const tenantId = this.requireTenantId(actor);
    const page = query?.page && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(100, query?.pageSize && query.pageSize > 0 ? query.pageSize : 20);
    const viewAll =
      actor.role === RoleName.SUPER_ADMIN ||
      actor.role === RoleName.ADMIN ||
      (actor.permissions ?? []).includes("approvals.view_all");

    const where: Prisma.ApprovalRequestWhereInput = {
      tenantId,
      status: query?.status ?? {
        in: [ApprovalRequestStatus.PENDING, ApprovalRequestStatus.EMERGENCY_OVERRIDE_PENDING_REVIEW]
      },
      ...(viewAll
        ? {}
        : {
            steps: {
              some: {
                status: { in: [ApprovalStepStatus.PENDING, ApprovalStepStatus.ESCALATED] },
                OR: [{ assignedApproverId: actor.sub }, { backupApproverId: actor.sub }]
              }
            }
          })
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.approvalRequest.count({ where }),
      this.prisma.approvalRequest.findMany({
        where,
        include: {
          steps: { orderBy: { level: "asc" } },
          requester: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { requestedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: items.map((item) => {
        const current = item.steps.find(
          (s) => s.status === ApprovalStepStatus.PENDING || s.status === ApprovalStepStatus.ESCALATED
        );
        return {
          ...item,
          currentLevel: current?.level ?? null,
          dueAt: current?.dueAt ?? null,
          overdue: current ? this.isStepOverdue(current) : false
        };
      }),
      meta: { page, pageSize, total }
    };
  }

  async getRequest(id: string, actor: Actor) {
    const tenantId = this.requireTenantId(actor);
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id, tenantId },
      include: {
        steps: { orderBy: { level: "asc" } },
        decisions: { orderBy: { decidedAt: "asc" }, include: { actor: { select: { id: true, firstName: true, lastName: true } } } },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        triggeredRule: { select: { id: true, name: true, version: true, processType: true } }
      }
    });
    if (!request) throw new NotFoundException("Approval request not found");
    return request;
  }

  private assertCanDecide(actor: Actor, step: { assignedApproverId: string | null; backupApproverId: string | null; status: ApprovalStepStatus }) {
    const privileged =
      actor.role === RoleName.SUPER_ADMIN ||
      actor.role === RoleName.ADMIN ||
      (actor.permissions ?? []).includes("approvals.view_all");
    const assigned =
      step.assignedApproverId === actor.sub ||
      (step.status === ApprovalStepStatus.ESCALATED && step.backupApproverId === actor.sub) ||
      step.backupApproverId === actor.sub;
    if (!privileged && !assigned) {
      throw new ForbiddenException("You are not the assigned approver for this step");
    }
  }

  async decide(input: {
    actor: Actor;
    requestId: string;
    decision: ApprovalDecisionOutcome;
    reason?: string;
  }) {
    const tenantId = this.requireTenantId(input.actor);
    const request = await this.getRequest(input.requestId, input.actor);

    if (
      request.status !== ApprovalRequestStatus.PENDING &&
      request.status !== ApprovalRequestStatus.EMERGENCY_OVERRIDE_PENDING_REVIEW
    ) {
      throw new BadRequestException("Approval request is not awaiting a decision");
    }

    const currentStep = request.steps.find(
      (s) => s.status === ApprovalStepStatus.PENDING || s.status === ApprovalStepStatus.ESCALATED
    );
    if (!currentStep) {
      throw new BadRequestException("No pending approval step");
    }

    this.assertCanDecide(input.actor, currentStep);

    if (input.decision === ApprovalDecisionOutcome.REJECTED) {
      const reason = input.reason?.trim();
      if (!reason || reason.length < 3) {
        throw new BadRequestException("Rejection reason is required");
      }
    }

    const decision = await this.prisma.$transaction(async (tx) => {
      const createdDecision = await tx.approvalDecision.create({
        data: {
          tenantId,
          approvalRequestId: request.id,
          approvalStepId: currentStep.id,
          actorId: input.actor.sub,
          decision: input.decision,
          reason: input.reason?.trim() || undefined
        }
      });

      await tx.approvalStep.update({
        where: { id: currentStep.id },
        data: {
          status:
            input.decision === ApprovalDecisionOutcome.APPROVED
              ? ApprovalStepStatus.APPROVED
              : ApprovalStepStatus.REJECTED,
          actedAt: new Date()
        }
      });

      if (input.decision === ApprovalDecisionOutcome.REJECTED) {
        await tx.approvalRequest.update({
          where: { id: request.id },
          data: {
            status: ApprovalRequestStatus.REJECTED,
            completedAt: new Date()
          }
        });
        return { createdDecision, finalStatus: ApprovalRequestStatus.REJECTED };
      }

      const remaining = request.steps.filter(
        (s) =>
          s.id !== currentStep.id &&
          (s.status === ApprovalStepStatus.PENDING || s.status === ApprovalStepStatus.ESCALATED)
      );

      if (remaining.length === 0) {
        await tx.approvalRequest.update({
          where: { id: request.id },
          data: {
            status: ApprovalRequestStatus.APPROVED,
            completedAt: new Date()
          }
        });
        return { createdDecision, finalStatus: ApprovalRequestStatus.APPROVED };
      }

      return { createdDecision, finalStatus: ApprovalRequestStatus.PENDING };
    });

    await this.audit({
      tenantId,
      actorId: input.actor.sub,
      entity: "ApprovalDecision",
      entityId: decision.createdDecision.id,
      action: AuditAction.CREATE,
      reason: input.reason,
      afterData: {
        decision: input.decision,
        requestId: request.id,
        level: currentStep.level,
        finalStatus: decision.finalStatus
      } as Prisma.InputJsonValue
    });

    await this.notifySafe({
      userId: request.requesterId,
      title:
        decision.finalStatus === ApprovalRequestStatus.APPROVED
          ? "Approval approved"
          : decision.finalStatus === ApprovalRequestStatus.REJECTED
            ? "Approval rejected"
            : "Approval step approved",
      message: `${request.processType} decision recorded`,
      type:
        decision.finalStatus === ApprovalRequestStatus.REJECTED
          ? NotificationType.APPROVAL_REJECTED
          : NotificationType.APPROVAL_APPROVED,
      priority: NotificationPriority.WARNING,
      referenceId: request.id,
      referenceType: "ApprovalRequest"
    });

    // Side-effect hooks for subject entities after final approval
    if (decision.finalStatus === ApprovalRequestStatus.APPROVED) {
      await this.applyApprovedSideEffects(request, input.actor);
    }

    return this.getRequest(request.id, input.actor);
  }

  private async applyApprovedSideEffects(
    request: {
      id: string;
      processType: ApprovalProcessType;
      subjectEntityType: string;
      subjectEntityId: string;
      sourceContext: Prisma.JsonValue | null;
    },
    actor: Actor
  ) {
    if (request.subjectEntityType === "WorkOrder") {
      if (
        request.processType === ApprovalProcessType.CRITICAL_WORK_ORDER ||
        request.processType === ApprovalProcessType.HIGH_COST_WORK_ORDER ||
        request.processType === ApprovalProcessType.VENDOR_REPAIR
      ) {
        await this.prisma.workOrder.updateMany({
          where: { id: request.subjectEntityId, tenantId: actor.tenantId! },
          data: {
            approvalStatus: "APPROVED",
            approvedAt: new Date(),
            approvedById: actor.sub
          }
        });
      }

      if (
        request.processType === ApprovalProcessType.WORK_ORDER_REOPEN ||
        request.processType === ApprovalProcessType.CLOSED_RECORD_CORRECTION
      ) {
        const ctx = (request.sourceContext ?? {}) as Record<string, unknown>;
        const reason = String(ctx.reason ?? "Approved reopen");
        await this.prisma.workOrder.updateMany({
          where: {
            id: request.subjectEntityId,
            tenantId: actor.tenantId!,
            status: { in: ["CLOSED", "COMPLETED", "CANCELLED", "VERIFIED"] }
          },
          data: {
            status: "IN_PROGRESS",
            completedDate: null,
            closedAt: null,
            reopenReason: reason,
            reopenedAt: new Date(),
            reopenedById: actor.sub,
            correctionReason: reason,
            verificationStatus: "PENDING",
            verifiedById: null,
            verifiedAt: null
          }
        });
      }
    }

    if (
      request.subjectEntityType === "Asset" &&
      request.processType === ApprovalProcessType.ASSET_RETIREMENT
    ) {
      const ctx = (request.sourceContext ?? {}) as Record<string, unknown>;
      const reason = String(ctx.reason ?? "Approved retirement");
      await this.prisma.asset.updateMany({
        where: { id: request.subjectEntityId, tenantId: actor.tenantId! },
        data: {
          status: "RETIRED",
          retiredAt: ctx.retiredAt ? new Date(String(ctx.retiredAt)) : new Date(),
          retirementReason: reason,
          isActive: false
        }
      });
    }
  }
}
