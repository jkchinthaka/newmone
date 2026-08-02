import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  GoLiveDecisionOption,
  GoLiveDecisionStage,
  Prisma,
  QaIssueSeverity,
  QaIssueStatus,
  RoleName,
  SupportTicketSeverity,
  SupportTicketStatus,
  UatEvidenceClass
} from "@prisma/client";

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
  formalUatComplete: boolean;
  formalTrainingComplete: boolean;
  portOwnerDecided: boolean;
  productionHttpsReady: boolean;
  productionBackupEvidence: boolean;
  decisionStage: GoLiveDecisionStage;
  recommendedDecision: GoLiveDecisionOption;
  /** Human-readable mapping: GO means GO_FOR_CUTOVER at PRE_CUTOVER only. */
  recommendedDecisionLabel: string;
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

  private truthyEnv(name: string): boolean {
    return ["true", "1", "yes", "on"].includes(String(process.env[name] || "").trim().toLowerCase());
  }

  private portOwnerDecided(): boolean {
    const owner = String(process.env.EDGE_PROXY_OWNER || "UNDECIDED").trim().toUpperCase();
    return owner === "NGINX" || owner === "IIS";
  }

  async evaluateCriteria(): Promise<GoLiveCriteriaSnapshot> {
    const where = this.tenantWhere();
    const tenantId = where.tenantId;
    const blockers: string[] = [];

    const [openCriticalQa, openCriticalTickets, openSecurityQa, backupReady, trainingReady, supportReady, signOffDone, rollbackPlan] =
      await Promise.all([
        this.prisma.qaIssue.count({
          where: {
            ...where,
            severity: QaIssueSeverity.CRITICAL,
            status: { notIn: [QaIssueStatus.CLOSED, QaIssueStatus.ACCEPTED_RISK, QaIssueStatus.PASSED] }
          }
        }),
        this.prisma.supportTicket.count({
          where: {
            ...where,
            severity: SupportTicketSeverity.CRITICAL,
            status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.RESOLVED] }
          }
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
        this.prisma.rollbackPlan.findFirst({
          where: { ...where, active: true },
          orderBy: { updatedAt: "desc" }
        })
      ]);

    const openCriticalIssues = openCriticalQa + openCriticalTickets;
    const rollbackReady = Boolean(rollbackPlan?.rollbackSteps && rollbackPlan.databaseRestoreReference);

    // Formal evidence cannot be inferred from E2E/synthetic cutover ticks.
    const e2eMode = this.truthyEnv("E2E_TEST_MODE");
    const formalUatComplete = this.truthyEnv("FORMAL_BUSINESS_UAT_COMPLETE") && !e2eMode;
    const formalTrainingComplete = this.truthyEnv("FORMAL_TRAINING_COMPLETE") && !e2eMode;
    const productionHttpsReady = this.truthyEnv("PRODUCTION_HTTPS_READY") && !e2eMode;
    const productionBackupEvidence =
      this.truthyEnv("PRODUCTION_BACKUP_EVIDENCE_COMPLETE") && !e2eMode;
    const portOwnerDecided = this.portOwnerDecided() && !e2eMode;

    if (openCriticalIssues > 0) blockers.push("Open critical issues exist");
    if (!backupReady) blockers.push("Backup checklist incomplete (tenant cutover)");
    if (!rollbackReady) blockers.push("Rollback plan missing or incomplete");
    if (openSecurityQa > 0) blockers.push("Open security/RBAC issues");
    if (!formalUatComplete) blockers.push("Formal business UAT incomplete");
    if (!formalTrainingComplete) blockers.push("Formal training incomplete");
    if (!portOwnerDecided) blockers.push("PORT_OWNER_DECISION_REQUIRED");
    if (!productionHttpsReady) blockers.push("Production HTTPS evidence missing");
    if (!productionBackupEvidence) blockers.push("Production off-host backup evidence missing");
    if (e2eMode) blockers.push("E2E/synthetic environment cannot authorize GO_FOR_CUTOVER");

    const deployReady = tenantId ? await this.cutover.isCategoryReady("DEPLOYMENT_READY") : false;

    let recommendedDecision: GoLiveDecisionOption = GoLiveDecisionOption.DELAYED;
    if (openCriticalIssues > 0 || openSecurityQa > 0) {
      recommendedDecision = GoLiveDecisionOption.NO_GO;
    } else if (
      !formalUatComplete ||
      !formalTrainingComplete ||
      !portOwnerDecided ||
      !productionHttpsReady ||
      !productionBackupEvidence ||
      !signOffDone ||
      e2eMode
    ) {
      recommendedDecision = GoLiveDecisionOption.DELAYED;
    } else if (!backupReady || !rollbackReady) {
      recommendedDecision = GoLiveDecisionOption.NO_GO;
    } else {
      // Real formal evidence present — still never auto-record GO; recommendation only.
      recommendedDecision = GoLiveDecisionOption.GO;
    }

    return {
      openCriticalIssues,
      openSecurityIssues: openSecurityQa,
      backupCompleted: backupReady,
      rollbackReady,
      pilotUsersTrained: trainingReady && formalTrainingComplete,
      smokeTestPassed: deployReady,
      coreWorkflowsWorking: deployReady,
      supportProcessReady: supportReady,
      managementSignOffDone: signOffDone,
      formalUatComplete,
      formalTrainingComplete,
      portOwnerDecided,
      productionHttpsReady,
      productionBackupEvidence,
      decisionStage: GoLiveDecisionStage.PRE_CUTOVER_DECISION,
      recommendedDecision,
      recommendedDecisionLabel:
        recommendedDecision === GoLiveDecisionOption.GO
          ? "GO_FOR_CUTOVER (recommendation only — human decision required)"
          : recommendedDecision,
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
    return { criteria, history, pendingHumanDecision: "PENDING_AUTHORIZED_HUMAN_DECISION" };
  }

  async recordDecision(dto: RecordGoLiveDecisionDto) {
    if (!this.canRecord()) throw new ForbiddenException("You do not have permission to record go-live decisions");
    const actorId = this.ctx().actorId;
    if (!actorId) throw new ForbiddenException("You do not have permission to perform this action");

    const criteria = await this.evaluateCriteria();
    const stage = GoLiveDecisionStage.PRE_CUTOVER_DECISION;

    if (dto.decision === GoLiveDecisionOption.GO || dto.decision === GoLiveDecisionOption.GO_WITH_ACCEPTED_RISK) {
      if (this.truthyEnv("E2E_TEST_MODE")) {
        throw new BadRequestException("Automated/E2E environments cannot record GO_FOR_CUTOVER");
      }
      if (!criteria.formalUatComplete) {
        throw new BadRequestException("Cannot record GO without formal business UAT evidence");
      }
      if (!criteria.formalTrainingComplete) {
        throw new BadRequestException("Cannot record GO without formal training completion");
      }
      if (!criteria.portOwnerDecided) {
        throw new BadRequestException("Cannot record GO without port-owner decision");
      }
      if (!criteria.productionHttpsReady) {
        throw new BadRequestException("Cannot record GO without production HTTPS evidence");
      }
      if (!criteria.productionBackupEvidence) {
        throw new BadRequestException("Cannot record GO without production backup evidence");
      }
      if (criteria.openCriticalIssues > 0) {
        throw new BadRequestException("Cannot record GO while critical blockers are open");
      }
      if (!criteria.backupCompleted) {
        throw new BadRequestException("Cannot record GO without backup completed");
      }
      if (!criteria.rollbackReady) {
        throw new BadRequestException("Cannot record GO without rollback plan ready");
      }
      if (criteria.openSecurityIssues > 0) {
        throw new BadRequestException("Cannot record GO while security/RBAC critical issues are open");
      }
      if (!criteria.managementSignOffDone) {
        throw new BadRequestException("Cannot record GO without required management sign-offs");
      }
    }
    if (dto.decision === GoLiveDecisionOption.GO_WITH_ACCEPTED_RISK && !dto.reason?.trim()) {
      throw new BadRequestException("GO_WITH_ACCEPTED_RISK requires reason");
    }

    // Post-deployment acceptance is Phase 8 only — refuse marking backend/frontend live as complete here.
    if (String((dto as { decisionStage?: string }).decisionStage || "") === "POST_DEPLOYMENT_ACCEPTANCE") {
      throw new BadRequestException("POST_DEPLOYMENT_ACCEPTANCE is not allowed in Phase 7");
    }

    const commitSha = String(process.env.APP_COMMIT_SHA || "").trim() || null;
    const evidenceClass = this.truthyEnv("E2E_TEST_MODE")
      ? UatEvidenceClass.SYNTHETIC
      : UatEvidenceClass.FORMAL_BUSINESS_UAT;

    const created = await this.prisma.goLiveDecision.create({
      data: {
        tenantId: this.tenantWhere().tenantId,
        decision: dto.decision,
        decisionStage: stage,
        applicationCommitSha: commitSha,
        evidenceClass,
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

    await this.audit(
      "go_live_decision_recorded",
      created.id,
      { decision: dto.decision, stage, commitSha, evidenceClass, criteria },
      dto.reason
    );
    return created;
  }
}
