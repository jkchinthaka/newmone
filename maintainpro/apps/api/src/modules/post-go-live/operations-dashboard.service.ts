import { ForbiddenException, Injectable } from "@nestjs/common";
import { AuditAction, ReleaseStatus, SupportTicketSeverity, SupportTicketStatus, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { ChangeRequestsService } from "./change-requests.service";
import { HandoverService } from "./handover.service";
import { HypercareService } from "./hypercare.service";
import { ReleasesService } from "./releases.service";
import { SupportTicketsService } from "./support-tickets.service";
import { TrainingService } from "./training.service";

@Injectable()
export class OperationsDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: SupportTicketsService,
    private readonly training: TrainingService,
    private readonly changeRequests: ChangeRequestsService,
    private readonly releases: ReleasesService,
    private readonly hypercare: HypercareService,
    private readonly handover: HandoverService
  ) {}

  private ctx() {
    const c = requestContext.get();
    return { actorRole: c?.actorRole ?? null, tenantId: c?.tenantId ?? null, permissions: c?.permissions ?? [] };
  }

  canView() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("operations.view") || permissions.includes("operations.manage");
  }

  private requireTenantId() {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole !== RoleName.SUPER_ADMIN && !tenantId) throw new ForbiddenException("Tenant context required");
    return tenantId;
  }

  async getDashboard() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view operations dashboard");
    const tenantId = this.requireTenantId();
    const base = tenantId ? { tenantId } : {};
    const openStatuses = { status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.DUPLICATE] as SupportTicketStatus[] } };

    const [openTickets, openCritical, slaBreaches, pendingCr, latestRelease, hypercarePlan, trainingStats] =
      await Promise.all([
        this.prisma.supportTicket.count({ where: { ...base, ...openStatuses } }),
        this.prisma.supportTicket.count({
          where: { ...base, ...openStatuses, severity: SupportTicketSeverity.CRITICAL }
        }),
        this.prisma.supportTicket.count({
          where: { ...base, OR: [{ firstResponseBreached: true }, { resolutionBreached: true }], ...openStatuses }
        }),
        this.changeRequests.pendingCount(),
        this.releases.latestVersion(),
        this.hypercare.activePlan(),
        this.training.completionStats()
      ]);

    return {
      openTickets,
      openCriticalTickets: openCritical,
      slaBreaches,
      pendingChangeRequests: pendingCr,
      upcomingReleases: await this.prisma.softwareRelease.count({
        where: { ...base, status: { in: [ReleaseStatus.SCHEDULED, ReleaseStatus.READY_FOR_UAT] } }
      }),
      hypercareStatus: hypercarePlan?.readinessStatus ?? null,
      trainingCompletionPercentage: trainingStats.completionPercentage,
      lastReleaseVersion: latestRelease?.version ?? null
    };
  }

  async getMonitoringDashboard() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view monitoring");
    const tenantId = this.requireTenantId();
    const base = tenantId ? { tenantId } : {};

    let healthSummary: Record<string, unknown> = { status: "unknown" };
    try {
      await this.prisma.$runCommandRaw({ ping: 1 });
      healthSummary = {
        status: "healthy",
        database: "healthy",
        timestamp: new Date().toISOString(),
        service: "maintainpro-api"
      };
    } catch {
      healthSummary = { status: "degraded", database: "unavailable", message: "Database ping failed" };
    }

    const [openCritical, slaBreaches, recentTickets, latestRelease, recentQa] = await Promise.all([
      this.prisma.supportTicket.count({
        where: {
          ...base,
          severity: SupportTicketSeverity.CRITICAL,
          status: { notIn: [SupportTicketStatus.CLOSED, SupportTicketStatus.DUPLICATE] }
        }
      }),
      this.tickets.getSlaBreaches(),
      this.prisma.supportTicket.findMany({
        where: base,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, ticketNo: true, title: true, severity: true, status: true, createdAt: true }
      }),
      this.releases.latestVersion(),
      this.prisma.qaIssue.findMany({
        where: base,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, issueNo: true, title: true, severity: true, status: true, createdAt: true }
      })
    ]);

    return {
      apiHealth: healthSummary,
      openCriticalTickets: openCritical,
      openSlaBreaches: slaBreaches.length,
      recentTickets,
      recentIncidents: recentQa,
      currentReleaseVersion: latestRelease?.version ?? null,
      lastDeploymentAt: latestRelease?.deployedAt ?? null
    };
  }

  async getPostGoLiveReport() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view post-go-live report");
    const [dashboard, sla, trainingStats, handoverDoc, hypercarePlan] = await Promise.all([
      this.getDashboard(),
      this.tickets.getSlaDashboard(),
      this.training.completionStats(),
      this.handover.getHandover(),
      this.hypercare.activePlan()
    ]);

    const report = {
      generatedAt: new Date().toISOString(),
      dashboard,
      sla,
      training: trainingStats,
      hypercare: hypercarePlan,
      handoverSections: Object.keys(handoverDoc).filter((k) => !["id", "tenantId", "createdAt", "updatedAt"].includes(k)),
      verdict:
        dashboard.openCriticalTickets > 0 || dashboard.slaBreaches > 5
          ? "NEEDS_ATTENTION"
          : dashboard.trainingCompletionPercentage >= 80
            ? "STABLE"
            : "ACTIVE_HYPERCARE"
    };

    await writeAuditTrail(this.prisma, {
      entity: "PostGoLive",
      entityId: "report",
      action: AuditAction.UPDATE,
      module: "post-go-live",
      metadata: { event: "post_go_live_report_exported", verdict: report.verdict }
    });

    return report;
  }
}
