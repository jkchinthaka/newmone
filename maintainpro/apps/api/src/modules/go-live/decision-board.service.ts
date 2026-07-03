import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, GoLiveDecisionOption, Prisma, QaIssueSeverity, QaIssueStatus, RoleName, SupportTicketSeverity, SupportTicketStatus } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { CutoverChecklistService } from "./cutover-checklist.service";
import { GoLiveSignOffService } from "./go-live-signoff.service";
import type { RecordGoLiveDecisionDto } from "./dto/go-live.dto";

export type GoLiveCriteriaSnapshot = {
  openCriticalIssues: number;
  openSecurityIssues: number;
  backupCompleted: boolean;
  rollbackReady: boolean;
  pilotUsersTrained: boolean;
  smokeTestPassed: boolean;
  coreWorkflowsWorking: boolean;
  supportProcessReady: boolean;
  managementSignOffDone: boolean;
  recommendedDecision: GoLiveDecisionOption;
  blockers: string[];
};

@Injectable()
export class DecisionBoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cutover: CutoverChecklistService,
    private readonly signOff: GoLiveSignOffService
  ) {}

  private ctx() {
    const c = requestContext.get();
    return {
      actorId: c?.actorId ?? null,
      actorRole: c?.actorRole ?? null,
      tenantId: c?.tenantId ?? null,
      permissions: c?.permissions ?? []
    };
  }

  canView(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("go_live.view") || permissions.includes("go_live.manage");
  }

  canRecord(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("go_live.manage");
  }

  private tenantWhere(): { tenantId?: string } {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN && !tenantId) return {};
    if (!tenantId) throw new BadRequestException("Tenant context is required");
    return { tenantId };
  }

  private async audit(event: string, entityId: string, metadata?: Record<string, unknown>, reason?: string) {
    await writeAuditTrail(this.prisma, {
      entity: "GoLiveDecision",
      entityId,
      action: AuditAction.CREATE,
      module: "go-live",
      reason,
      metadata: { event, ...metadata } as Prisma.InputJsonValue
    });
  }

  async evaluateCriteria(): Promise<GoLiveCriteriaSnapshot> {
    const where = this.tenantWhere();
    const tenantId = where.tenantId;
    const blockers: string[] = [];

    const [openCriticalQa, openCriticalTickets, openSecurityQa, backupReady, trainingReady, supportReady, signOffDone, rollbackPlan] =
      await Promise.all([
        this.prisma.qaIssue.count({
          where: { ...where, severity: QaIssueSeverity.CRITICAL, status: { notIn: [QaIssueStatus.CLOSED, QaIssueStatus.ACCEPTED_RISK, QaIssueStatus.PASSED] } }
        }),
        this.prisma.supportTicket.count({
          where: { ...where, severity: SupportTicketSeverity.CRITICAL, status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.RESOLVED] } }
        }),
        this.prisma.qaIssue.count({
          where: {
            ...where,
            category: "SECURITY_ERROR",
            severity: { in: [QaIssueSeverity.CRITICAL, QaIssueSeverity.HIGH] },
            status: { notIn: [QaIssueStatus.CLOSED, QaIssueStatus.ACCEPTED_RISK, QaIssueStatus.PASSED] }
          }
        }),
        tenantId ? this.cutover.isBackupReady() : Promise.resolve(false),
        tenantId ? this.cutover.isTrainingReady() : Promise.resolve(false),
        tenantId ? this.cutover.isCategoryReady("SUPPORT_READY") : Promise.resolve(false),
        tenantId ? this.signOff.hasRequiredSignOffs() : Promise.resolve(false),
        this.prisma.rollbackPlan.findFirst({ where: { ...where, active: true }, orderBy: { updatedAt: "desc" } })
      ]);

    const openCriticalIssues = openCriticalQa + openCriticalTickets;
    const rollbackReady = Boolean(rollbackPlan?.rollbackSteps && rollbackPlan.databaseRestoreReference);

    if (openCriticalIssues > 0) blockers.push("Open critical issues exist");
    if (!backupReady) blockers.push("Backup not completed");
    if (!rollbackReady) blockers.push("Rollback plan missing or incomplete");
    if (openSecurityQa > 0) blockers.push("Open security/RBAC issues");

    const deployReady = tenantId ? await this.cutover.isCategoryReady("DEPLOYMENT_READY") : false;

    let recommendedDecision: GoLiveDecisionOption = GoLiveDecisionOption.GO;
    if (openCriticalIssues > 0 || !backupReady || !rollbackReady || openSecurityQa > 0) {
      recommendedDecision = GoLiveDecisionOption.NO_GO;
    } else if (!signOffDone || !trainingReady) {
      recommendedDecision = GoLiveDecisionOption.DELAYED;
    } else if (!deployReady) {
      recommendedDecision = GoLiveDecisionOption.GO_WITH_ACCEPTED_RISK;
    }

    return {
      openCriticalIssues,
      openSecurityIssues: openSecurityQa,
      backupCompleted: backupReady,
      rollbackReady,
      pilotUsersTrained: trainingReady,
      smokeTestPassed: deployReady,
      coreWorkflowsWorking: deployReady,
      supportProcessReady: supportReady,
      managementSignOffDone: signOffDone,
      recommendedDecision,
      blockers
    };
  }

  async getDecisionBoard() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view go/no-go board");
    const where = this.tenantWhere();
    const [criteria, history] = await Promise.all([
      this.evaluateCriteria(),
      this.prisma.goLiveDecision.findMany({ where, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    return { criteria, history };
  }

  async recordDecision(dto: RecordGoLiveDecisionDto) {
    if (!this.canRecord()) throw new ForbiddenException("You do not have permission to record go-live decisions");
    const actorId = this.ctx().actorId;
    if (!actorId) throw new ForbiddenException("You do not have permission to perform this action");

    const criteria = await this.evaluateCriteria();

    if (dto.decision === GoLiveDecisionOption.GO && criteria.openCriticalIssues > 0) {
      throw new BadRequestException("Cannot record GO while critical blockers are open");
    }
    if (dto.decision === GoLiveDecisionOption.GO && !criteria.backupCompleted) {
      throw new BadRequestException("Cannot record GO without backup completed");
    }
    if (dto.decision === GoLiveDecisionOption.GO && !criteria.rollbackReady) {
      throw new BadRequestException("Cannot record GO without rollback plan ready");
    }
    if (dto.decision === GoLiveDecisionOption.GO && criteria.openSecurityIssues > 0) {
      throw new BadRequestException("Cannot record GO while security/RBAC critical issues are open");
    }
    if (dto.decision === GoLiveDecisionOption.GO_WITH_ACCEPTED_RISK && !dto.reason?.trim()) {
      throw new BadRequestException("GO_WITH_ACCEPTED_RISK requires reason");
    }

    const created = await this.prisma.goLiveDecision.create({
      data: {
        tenantId: this.tenantWhere().tenantId,
        decision: dto.decision,
        reason: dto.reason,
        criteriaSnapshot: criteria as unknown as Prisma.InputJsonValue,
        recordedByUserId: actorId,
        openCriticalIssues: criteria.openCriticalIssues,
        backupCompleted: criteria.backupCompleted,
        rollbackReady: criteria.rollbackReady,
        pilotUsersTrained: criteria.pilotUsersTrained,
        smokeTestPassed: dto.smokeTestPassed ?? criteria.smokeTestPassed,
        coreWorkflowsWorking: dto.coreWorkflowsWorking ?? criteria.coreWorkflowsWorking,
        supportProcessReady: criteria.supportProcessReady,
        managementSignOffDone: criteria.managementSignOffDone
      }
    });

    await this.audit("go_live_decision_recorded", created.id, { decision: dto.decision, criteria }, dto.reason);
    return created;
  }
}
