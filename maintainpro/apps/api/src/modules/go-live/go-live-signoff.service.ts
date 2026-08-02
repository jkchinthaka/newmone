import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, GoLiveSignOffDecision, Prisma, RoleName, UatEvidenceClass } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import {
  MAX_SIGN_OFF_CATEGORIES_PER_USER,
  REQUIRED_SIGN_OFF_ROLES,
  SIGN_OFF_ROLE_AUTHORIZATION,
  type RequiredSignOffRole
} from "./go-live.constants";
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

  /**
   * Reject client-forged sign-off categories and enforce signer-to-role matrix.
   */
  assertSignOffRoleAuthorized(signOffRole: string): asserts signOffRole is RequiredSignOffRole {
    if (!(REQUIRED_SIGN_OFF_ROLES as readonly string[]).includes(signOffRole)) {
      throw new BadRequestException("Invalid sign-off category");
    }
    const role = signOffRole as RequiredSignOffRole;
    const matrix = SIGN_OFF_ROLE_AUTHORIZATION[role];
    const { actorRole, permissions } = this.ctx();
    const hasCategoryPermission = permissions.includes(matrix.categoryPermission);
    const roleAllowed =
      !!actorRole && (matrix.allowedRoles as string[]).includes(actorRole);
    const hasBase = this.canSignOff();
    if (!hasBase) {
      throw new ForbiddenException("You do not have permission to sign off go-live");
    }
    if (!roleAllowed && !hasCategoryPermission) {
      throw new ForbiddenException("You are not authorized for the selected sign-off category");
    }
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
    const commitSha = String(process.env.APP_COMMIT_SHA || "").trim();
    const e2eMode = ["true", "1", "yes", "on"].includes(
      String(process.env.E2E_TEST_MODE || "").trim().toLowerCase()
    );
    const signOffs = await this.prisma.goLiveSignOff.findMany({
      where: { tenantId, revokedAt: null }
    });
    const approvedRoles = new Set(
      signOffs
        .filter((s) => {
          const approved =
            s.decision === GoLiveSignOffDecision.APPROVED ||
            s.decision === GoLiveSignOffDecision.APPROVED_WITH_RISK;
          if (!approved) return false;
          // Synthetic CI sign-offs never satisfy formal readiness.
          if (!e2eMode && (s as { evidenceClass?: string }).evidenceClass === UatEvidenceClass.SYNTHETIC) return false;
          if (
            !e2eMode &&
            commitSha &&
            (s as { applicationCommitSha?: string | null }).applicationCommitSha &&
            (s as { applicationCommitSha?: string | null }).applicationCommitSha !== commitSha
          ) {
            return false;
          }
          return true;
        })
        .map((s) => s.signOffRole)
    );
    return REQUIRED_SIGN_OFF_ROLES.every((role) => approvedRoles.has(role));
  }

  async createSignOff(dto: CreateGoLiveSignOffDto) {
    if (!this.canSignOff()) throw new ForbiddenException("You do not have permission to sign off go-live");
    const actorId = this.ctx().actorId;
    if (!actorId) throw new ForbiddenException("You do not have permission to perform this action");

    this.assertSignOffRoleAuthorized(dto.signOffRole);

    if (
      dto.decision === GoLiveSignOffDecision.APPROVED_WITH_RISK &&
      !dto.acceptedRisks?.trim() &&
      !dto.reason?.trim()
    ) {
      throw new BadRequestException("Accepted risk requires reason or acceptedRisks");
    }

    const tenantId = this.tenantId();
    const existingForActor = await this.prisma.goLiveSignOff.findMany({
      where: {
        tenantId,
        signedByUserId: actorId,
        revokedAt: null,
        decision: {
          in: [GoLiveSignOffDecision.APPROVED, GoLiveSignOffDecision.APPROVED_WITH_RISK]
        }
      }
    });
    const distinctCategories = new Set(existingForActor.map((s) => s.signOffRole));
    if (
      !distinctCategories.has(dto.signOffRole) &&
      distinctCategories.size >= MAX_SIGN_OFF_CATEGORIES_PER_USER
    ) {
      throw new ForbiddenException(
        "Signer has reached the maximum number of sign-off categories for this tenant"
      );
    }

    const created = await this.prisma.goLiveSignOff.create({
      data: {
        tenantId,
        signOffRole: dto.signOffRole,
        signedByUserId: actorId,
        decision: dto.decision,
        comments: dto.comments,
        acceptedRisks: dto.acceptedRisks ?? dto.reason,
        signedAt: new Date(),
        applicationCommitSha: String(process.env.APP_COMMIT_SHA || "").trim() || null,
        evidenceClass:
          String(process.env.E2E_TEST_MODE || "").toLowerCase() === "true"
            ? UatEvidenceClass.SYNTHETIC
            : UatEvidenceClass.FORMAL_BUSINESS_UAT
      }
    });
    await this.audit("go_live_signoff_created", created.id, dto.reason, {
      role: dto.signOffRole,
      decision: dto.decision
    });
    return created;
  }

  async revokeSignOff(id: string, dto: RevokeSignOffDto) {
    if (!this.canSignOff()) throw new ForbiddenException("You do not have permission to revoke sign-offs");
    if (!dto.reason?.trim()) throw new BadRequestException("Revocation requires a reason");
    const tenantId = this.tenantId();
    const existing = await this.prisma.goLiveSignOff.findFirst({
      where: { id, tenantId, revokedAt: null }
    });
    if (!existing) throw new NotFoundException("Sign-off not found");

    const updated = await this.prisma.goLiveSignOff.update({
      where: { id },
      data: { revokedAt: new Date(), revokeReason: dto.reason }
    });
    await this.audit("go_live_signoff_revoked", id, dto.reason, { role: existing.signOffRole });
    return updated;
  }
}
