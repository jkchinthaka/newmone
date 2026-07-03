import { ForbiddenException, Injectable } from "@nestjs/common";
import { AuditAction, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { sanitizeHandoverDoc, sanitizeOperationsText } from "./operations-sanitize.util";
import type { UpdateHandoverDto } from "./dto/operations.dto";

const DEFAULT_HANDOVER = {
  systemUrls: "Production web: [configured in deployment]\nProduction API: [configured in deployment]",
  rolesResponsibilities: "Admin: platform config. IT Manager: support/SLA. Manager: approvals. Technicians: work orders.",
  supportContacts: "IT Support: contact your assigned support owner during hypercare.",
  escalationMatrix: "L1 Support → L2 IT Manager → L3 Department Manager → L4 Senior Management",
  backupProcess: "Atlas automated backup + manual export before major releases.",
  restoreProcess: "Restore from Atlas snapshot or manual backup per runbook.",
  deploymentProcess: "Render (API) + Cloudflare Workers (web). Smoke test after deploy.",
  rollbackProcess: "Redeploy previous Render/Cloudflare version using recorded commit hash.",
  knownLimitations: "See QA & Incidents → Known Issues.",
  commonIssuesFixes: "Login issues: check role and temp password expiry. WO stuck: verify supervisor verification step.",
  trainingMaterials: "See Post-Go-Live → Training Tracker.",
  changeRequestProcess: "Submit via Change Requests module; manager approval required.",
  incidentProcess: "Report via Support Tickets; critical issues auto-link to QA incidents."
};

@Injectable()
export class HandoverService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = requestContext.get();
    return { actorId: c?.actorId ?? null, actorRole: c?.actorRole ?? null, tenantId: c?.tenantId ?? null, permissions: c?.permissions ?? [] };
  }

  private requireTenantId() {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole !== RoleName.SUPER_ADMIN && !tenantId) throw new ForbiddenException("Tenant context required");
    return tenantId;
  }

  canView() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("operations.view") || permissions.includes("operations.manage");
  }

  canManage() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("operations.manage");
  }

  async ensureHandover(tenantId: string) {
    const existing = await this.prisma.supportHandover.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return this.prisma.supportHandover.create({
      data: { tenantId, ...DEFAULT_HANDOVER }
    });
  }

  async getHandover() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view handover documentation");
    const tenantId = this.requireTenantId();
    if (!tenantId) throw new ForbiddenException("Tenant context required");
    const doc = await this.ensureHandover(tenantId);
    return sanitizeHandoverDoc(doc as unknown as Record<string, unknown>);
  }

  async updateHandover(dto: UpdateHandoverDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to update handover documentation");
    const tenantId = this.requireTenantId();
    const actorId = this.ctx().actorId;
    if (!tenantId) throw new ForbiddenException("Tenant context required");
    await this.ensureHandover(tenantId);
    const updated = await this.prisma.supportHandover.update({
      where: { tenantId },
      data: {
        ...(dto.systemUrls !== undefined ? { systemUrls: sanitizeOperationsText(dto.systemUrls) } : {}),
        ...(dto.rolesResponsibilities !== undefined ? { rolesResponsibilities: sanitizeOperationsText(dto.rolesResponsibilities) } : {}),
        ...(dto.supportContacts !== undefined ? { supportContacts: sanitizeOperationsText(dto.supportContacts) } : {}),
        ...(dto.escalationMatrix !== undefined ? { escalationMatrix: sanitizeOperationsText(dto.escalationMatrix) } : {}),
        ...(dto.backupProcess !== undefined ? { backupProcess: sanitizeOperationsText(dto.backupProcess) } : {}),
        ...(dto.restoreProcess !== undefined ? { restoreProcess: sanitizeOperationsText(dto.restoreProcess) } : {}),
        ...(dto.deploymentProcess !== undefined ? { deploymentProcess: sanitizeOperationsText(dto.deploymentProcess) } : {}),
        ...(dto.rollbackProcess !== undefined ? { rollbackProcess: sanitizeOperationsText(dto.rollbackProcess) } : {}),
        ...(dto.knownLimitations !== undefined ? { knownLimitations: sanitizeOperationsText(dto.knownLimitations) } : {}),
        ...(dto.commonIssuesFixes !== undefined ? { commonIssuesFixes: sanitizeOperationsText(dto.commonIssuesFixes) } : {}),
        ...(dto.trainingMaterials !== undefined ? { trainingMaterials: sanitizeOperationsText(dto.trainingMaterials) } : {}),
        ...(dto.changeRequestProcess !== undefined ? { changeRequestProcess: sanitizeOperationsText(dto.changeRequestProcess) } : {}),
        ...(dto.incidentProcess !== undefined ? { incidentProcess: sanitizeOperationsText(dto.incidentProcess) } : {}),
        updatedByUserId: actorId
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "SupportHandover",
      entityId: tenantId,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      metadata: { event: "handover_updated" }
    });
    return sanitizeHandoverDoc(updated as unknown as Record<string, unknown>);
  }
}
