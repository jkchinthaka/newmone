import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  GoLiveDecisionOption,
  GoLiveSignOffDecision,
  Prisma,
  QaIssueSeverity,
  QaIssueStatus,
  RoleName,
  SupportTicketSeverity,
  SupportTicketStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { CUTOVER_CATEGORY_CATALOG, isCutoverPassing, REQUIRED_SIGN_OFF_ROLES, type GoLiveReadinessVerdict } from "./go-live.constants";
import { CutoverChecklistService } from "./cutover-checklist.service";
import { DecisionBoardService } from "./decision-board.service";

@Injectable()
export class GoLiveDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cutover: CutoverChecklistService,
    private readonly decisionBoard: DecisionBoardService
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

  canManage(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("go_live.manage");
  }

  canExport(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("go_live.export");
  }

  private requireView() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view go-live control");
  }

  private tenantWhere(): { tenantId?: string } {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN && !tenantId) return {};
    if (!tenantId) throw new BadRequestException("Tenant context is required");
    return { tenantId };
  }

  private async audit(event: string, entityId: string, reason?: string, metadata?: Record<string, unknown>) {
    await writeAuditTrail(this.prisma, {
      entity: "GoLiveControl",
      entityId,
      action: AuditAction.UPDATE,
      module: "go-live",
      reason,
      metadata: { event, ...metadata } as Prisma.InputJsonValue
    });
  }

  async countCriticalBlockers() {
    const where = this.tenantWhere();
    const [qaCritical, ticketCritical] = await Promise.all([
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
      })
    ]);
    return qaCritical + ticketCritical;
  }

  async getDashboard() {
    this.requireView();
    const where = this.tenantWhere();
    const [
      activePilot,
      cutoverStats,
      criticalBlockers,
      rollbackPlan,
      signOffs,
      activeWave,
      criteria,
      latestDecision
    ] = await Promise.all([
      this.prisma.pilotRollout.findFirst({ where: { ...where, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } }),
      this.cutover.getCompletionStats(),
      this.countCriticalBlockers(),
      this.prisma.rollbackPlan.findFirst({ where: { ...where, active: true }, orderBy: { updatedAt: "desc" } }),
      this.prisma.goLiveSignOff.findMany({ where: { ...where, revokedAt: null } }),
      this.prisma.rolloutWave.findFirst({ where: { ...where, status: "ACTIVE" }, orderBy: { waveNo: "asc" } }),
      this.decisionBoard.evaluateCriteria(),
      this.prisma.goLiveDecision.findFirst({ where, orderBy: { createdAt: "desc" } })
    ]);

    const requiredSignOffs = REQUIRED_SIGN_OFF_ROLES.length;
    const approvedSignOffs = signOffs.filter(
      (s) => s.decision === GoLiveSignOffDecision.APPROVED || s.decision === GoLiveSignOffDecision.APPROVED_WITH_RISK
    ).length;

    const backupReady = criteria.backupCompleted;
    const rollbackReady = Boolean(rollbackPlan?.rollbackSteps && rollbackPlan.databaseRestoreReference);

    let readinessVerdict: GoLiveReadinessVerdict = "NOT_READY";
    if (criticalBlockers > 0) readinessVerdict = "NO_GO";
    else if (latestDecision?.decision === GoLiveDecisionOption.GO) readinessVerdict = "GO";
    else if (latestDecision?.decision === GoLiveDecisionOption.GO_WITH_ACCEPTED_RISK) {
      readinessVerdict = "GO_WITH_RISK";
    } else if (activePilot?.status === "ACTIVE") readinessVerdict = "PILOT_READY";
    else if (cutoverStats.completionPercentage >= 90 && backupReady && rollbackReady) {
      readinessVerdict = "PILOT_READY";
    }

    return {
      readinessVerdict,
      pilotStatus: activePilot?.status ?? "NONE",
      cutoverCompletionPercentage: cutoverStats.completionPercentage,
      openCriticalBlockers: criticalBlockers,
      backupStatus: backupReady ? "READY" : "MISSING",
      rollbackStatus: rollbackReady ? "READY" : "MISSING",
      signOffStatus: `${approvedSignOffs}/${requiredSignOffs}`,
      rolloutWaveStatus: activeWave?.status ?? "NONE",
      activeWaveName: activeWave?.waveName ?? null,
      latestDecision: latestDecision?.decision ?? null,
      openHighIssues: await this.prisma.qaIssue.count({
        where: {
          ...where,
          severity: QaIssueSeverity.HIGH,
          status: { notIn: [QaIssueStatus.CLOSED, QaIssueStatus.ACCEPTED_RISK, QaIssueStatus.PASSED] }
        }
      }),
      openSupportTickets: await this.prisma.supportTicket.count({
        where: {
          ...where,
          status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.RESOLVED] }
        }
      }),
      slaBreaches: await this.prisma.supportTicket.count({
        where: { ...where, OR: [{ firstResponseBreached: true }, { resolutionBreached: true }] }
      })
    };
  }

  async getLiveIssueTracker() {
    this.requireView();
    const where = this.tenantWhere();
    const [criticalQa, highQa, criticalTickets, slaBreaches, openTickets] = await Promise.all([
      this.prisma.qaIssue.findMany({
        where: { ...where, severity: QaIssueSeverity.CRITICAL, status: { notIn: [QaIssueStatus.CLOSED, QaIssueStatus.ACCEPTED_RISK, QaIssueStatus.PASSED] } },
        take: 20,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.qaIssue.findMany({
        where: { ...where, severity: QaIssueSeverity.HIGH, status: { notIn: [QaIssueStatus.CLOSED, QaIssueStatus.ACCEPTED_RISK, QaIssueStatus.PASSED] } },
        take: 20,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.supportTicket.findMany({
        where: { ...where, severity: SupportTicketSeverity.CRITICAL, status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.RESOLVED] } },
        take: 20,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.supportTicket.count({
        where: { ...where, OR: [{ firstResponseBreached: true }, { resolutionBreached: true }] }
      }),
      this.prisma.supportTicket.count({
        where: { ...where, status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.RESOLVED] } }
      })
    ]);

    const moduleIssues = await this.prisma.supportTicket.groupBy({
      by: ["affectedModule"],
      where: { ...where, status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.RESOLVED] } },
      _count: { _all: true }
    });

    return {
      openCriticalIssues: criticalQa.length + criticalTickets.length,
      openHighIssues: highQa.length,
      openSupportTickets: openTickets,
      slaBreaches,
      criticalQaIssues: criticalQa,
      criticalSupportTickets: criticalTickets,
      repeatedModuleIssues: moduleIssues.filter((m) => m._count._all >= 3),
      rollbackRisk: criticalQa.length + criticalTickets.length > 0 ? "HIGH" : "LOW"
    };
  }

  async getFinalReport() {
    this.requireView();
    const [dashboard, liveIssues, cutover, criteria, pilots, waves, rollback, signOffs] = await Promise.all([
      this.getDashboard(),
      this.getLiveIssueTracker(),
      this.cutover.findAll(),
      this.decisionBoard.evaluateCriteria(),
      this.prisma.pilotRollout.findMany({ where: this.tenantWhere(), orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.rolloutWave.findMany({ where: this.tenantWhere(), orderBy: { waveNo: "asc" } }),
      this.prisma.rollbackPlan.findFirst({ where: { ...this.tenantWhere(), active: true }, orderBy: { updatedAt: "desc" } }),
      this.prisma.goLiveSignOff.findMany({ where: { ...this.tenantWhere(), revokedAt: null } })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      readinessVerdict: dashboard.readinessVerdict,
      dashboard,
      liveIssues,
      cutoverCompletionPercentage: dashboard.cutoverCompletionPercentage,
      decisionCriteria: criteria,
      recentPilots: pilots,
      rolloutWaves: waves,
      rollbackPlanReady: Boolean(rollback?.rollbackSteps),
      signOffs,
      categories: CUTOVER_CATEGORY_CATALOG.map((c) => c.key)
    };
  }

  async exportReport() {
    if (!this.canExport()) throw new ForbiddenException("You do not have permission to export go-live report");
    const report = await this.getFinalReport();
    await this.audit("go_live_report_exported", "report", undefined, { verdict: report.readinessVerdict });
    return report;
  }
}
