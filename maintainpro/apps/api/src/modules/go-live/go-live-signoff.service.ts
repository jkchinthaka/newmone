import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, GoLiveSignOffDecision, Prisma, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { REQUIRED_SIGN_OFF_ROLES } from "./go-live.constants";
import type { CreateGoLiveSignOffDto, RevokeSignOffDto } from "./dto/go-live.dto";

@Injectable()
export class GoLiveSignOffService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = requestContext.get();
    return {
      actorId: c?.actorId ?? null,
      actorRole: c?.actorRole ?? null,
      tenantId: c?.tenantId ?? null,
      permissions: c?.permissions ?? []
    };
  }

  canSignOff(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("go_live.sign_off") || permissions.includes("go_live.manage");
  }

  canView(): boolean {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("go_live.view") || permissions.includes("go_live.sign_off");
  }

  private tenantId(): string {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN && tenantId) return tenantId;
    if (!tenantId) throw new BadRequestException("Tenant context is required");
    return tenantId;
  }

  private async audit(event: string, entityId: string, reason?: string, metadata?: Record<string, unknown>) {
    await writeAuditTrail(this.prisma, {
      entity: "GoLiveSignOff",
      entityId,
      action: AuditAction.UPDATE,
      module: "go-live",
      reason,
      metadata: { event, ...metadata } as Prisma.InputJsonValue
    });
  }

  async findAll() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view sign-offs");
    return this.prisma.goLiveSignOff.findMany({
      where: { tenantId: this.tenantId(), revokedAt: null },
      orderBy: { signedAt: "desc" }
    });
  }

  async hasRequiredSignOffs(): Promise<boolean> {
    const tenantId = this.tenantId();
    const signOffs = await this.prisma.goLiveSignOff.findMany({
      where: { tenantId, revokedAt: null }
    });
    const approvedRoles = new Set(
      signOffs
        .filter(
          (s) =>
            s.decision === GoLiveSignOffDecision.APPROVED || s.decision === GoLiveSignOffDecision.APPROVED_WITH_RISK
        )
        .map((s) => s.signOffRole)
    );
    return REQUIRED_SIGN_OFF_ROLES.every((role) => approvedRoles.has(role));
  }

  async createSignOff(dto: CreateGoLiveSignOffDto) {
    if (!this.canSignOff()) throw new ForbiddenException("You do not have permission to sign off go-live");
    const actorId = this.ctx().actorId;
    if (!actorId) throw new ForbiddenException("You do not have permission to perform this action");

    if (dto.decision === GoLiveSignOffDecision.APPROVED_WITH_RISK && !dto.acceptedRisks?.trim() && !dto.reason?.trim()) {
      throw new BadRequestException("Accepted risk requires reason or acceptedRisks");
    }

    const tenantId = this.tenantId();
    const created = await this.prisma.goLiveSignOff.create({
      data: {
        tenantId,
        signOffRole: dto.signOffRole,
        signedByUserId: actorId,
        decision: dto.decision,
        comments: dto.comments,
        acceptedRisks: dto.acceptedRisks ?? dto.reason,
        signedAt: new Date()
      }
    });
    await this.audit("go_live_signoff_created", created.id, dto.reason, { role: dto.signOffRole, decision: dto.decision });
    return created;
  }

  async revokeSignOff(id: string, dto: RevokeSignOffDto) {
    if (!this.canSignOff()) throw new ForbiddenException("You do not have permission to revoke sign-offs");
    const tenantId = this.tenantId();
    const existing = await this.prisma.goLiveSignOff.findFirst({ where: { id, tenantId, revokedAt: null } });
    if (!existing) throw new NotFoundException("Sign-off not found");

    const updated = await this.prisma.goLiveSignOff.update({
      where: { id },
      data: { revokedAt: new Date(), revokeReason: dto.reason }
    });
    await this.audit("go_live_signoff_revoked", id, dto.reason, { role: existing.signOffRole });
    return updated;
  }
}
