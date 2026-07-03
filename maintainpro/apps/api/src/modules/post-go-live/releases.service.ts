import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, ChangeRequestStatus, Prisma, ReleaseStatus, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { createPaginationMeta } from "../../common/utils/pagination-meta";
import { clampPage, clampPageSize } from "../../common/utils/pagination.util";
import { PrismaService } from "../../database/prisma.service";
import { sanitizeOperationsText } from "./operations-sanitize.util";
import type {
  CreateReleaseDto,
  MarkDeployedDto,
  OperationsListQueryDto,
  RollbackReleaseDto,
  UpdateReleaseDto
} from "./dto/operations.dto";

@Injectable()
export class ReleasesService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = requestContext.get();
    return { actorId: c?.actorId ?? null, actorRole: c?.actorRole ?? null, tenantId: c?.tenantId ?? null, permissions: c?.permissions ?? [] };
  }

  private requireActorId() {
    const { actorId } = this.ctx();
    if (!actorId) throw new ForbiddenException("You do not have permission to perform this action");
    return actorId;
  }

  private requireTenantId() {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole !== RoleName.SUPER_ADMIN && !tenantId) throw new ForbiddenException("Tenant context required");
    return tenantId;
  }

  canManage() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("release.manage");
  }

  private async nextNo(tenantId: string | null) {
    const count = await this.prisma.softwareRelease.count({ where: tenantId ? { tenantId } : {} });
    return `REL-${String(count + 1).padStart(4, "0")}`;
  }

  private assertProductionReady(release: { backupTaken: boolean; rollbackPlan: string | null; releaseNotes: string | null }) {
    if (!release.backupTaken) throw new BadRequestException("Production release requires backupTaken = true");
    if (!release.rollbackPlan?.trim()) throw new BadRequestException("Production release requires a rollback plan");
    if (!release.releaseNotes?.trim()) throw new BadRequestException("Production release requires release notes");
  }

  async findAll(query: OperationsListQueryDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to view releases");
    const tenantId = this.requireTenantId();
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const where: Prisma.SoftwareReleaseWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(query.status ? { status: query.status as ReleaseStatus } : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.softwareRelease.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.softwareRelease.count({ where })
    ]);
    return { items, meta: createPaginationMeta(page, pageSize, total) };
  }

  async findOne(id: string) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to view releases");
    const tenantId = this.requireTenantId();
    const release = await this.prisma.softwareRelease.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!release) throw new NotFoundException("Release not found");
    return release;
  }

  async create(dto: CreateReleaseDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage releases");
    const tenantId = this.requireTenantId();
    const release = await this.prisma.softwareRelease.create({
      data: {
        tenantId,
        releaseNo: await this.nextNo(tenantId),
        version: dto.version.trim(),
        title: dto.title.trim(),
        description: dto.description ? sanitizeOperationsText(dto.description) : null,
        releaseType: dto.releaseType ?? "MINOR",
        releaseNotes: dto.releaseNotes ? sanitizeOperationsText(dto.releaseNotes) : null,
        rollbackPlan: dto.rollbackPlan ? sanitizeOperationsText(dto.rollbackPlan) : null,
        backupTaken: dto.backupTaken ?? false,
        backupReference: dto.backupReference?.trim() || null,
        linkedChangeRequests: dto.linkedChangeRequests ?? [],
        status: ReleaseStatus.DRAFT
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "SoftwareRelease",
      entityId: release.id,
      action: AuditAction.CREATE,
      module: "post-go-live",
      metadata: { event: "release_created", version: dto.version }
    });
    return release;
  }

  async update(id: string, dto: UpdateReleaseDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage releases");
    const tenantId = this.requireTenantId();
    const existing = await this.prisma.softwareRelease.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Release not found");
    return this.prisma.softwareRelease.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: sanitizeOperationsText(dto.description) } : {}),
        ...(dto.releaseNotes !== undefined ? { releaseNotes: sanitizeOperationsText(dto.releaseNotes) } : {}),
        ...(dto.rollbackPlan !== undefined ? { rollbackPlan: sanitizeOperationsText(dto.rollbackPlan) } : {}),
        ...(dto.backupTaken !== undefined ? { backupTaken: dto.backupTaken } : {}),
        ...(dto.backupReference !== undefined ? { backupReference: dto.backupReference?.trim() || null } : {}),
        ...(dto.commitHash !== undefined ? { commitHash: dto.commitHash?.trim() || null } : {})
      }
    });
  }

  async schedule(id: string) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage releases");
    const tenantId = this.requireTenantId();
    const existing = await this.prisma.softwareRelease.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Release not found");
    this.assertProductionReady(existing);
    const updated = await this.prisma.softwareRelease.update({
      where: { id },
      data: { status: ReleaseStatus.SCHEDULED }
    });
    await writeAuditTrail(this.prisma, {
      entity: "SoftwareRelease",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      metadata: { event: "release_scheduled" }
    });
    return updated;
  }

  async markDeployed(id: string, dto: MarkDeployedDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage releases");
    const tenantId = this.requireTenantId();
    const actorId = this.requireActorId();
    const existing = await this.prisma.softwareRelease.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Release not found");
    this.assertProductionReady(existing);

    const updated = await this.prisma.softwareRelease.update({
      where: { id },
      data: {
        status: ReleaseStatus.DEPLOYED,
        deployedByUserId: actorId,
        deployedAt: new Date(),
        renderDeployId: dto.renderDeployId?.trim() || existing.renderDeployId,
        cloudflareDeployId: dto.cloudflareDeployId?.trim() || existing.cloudflareDeployId,
        commitHash: dto.commitHash?.trim() || existing.commitHash
      }
    });

    for (const crId of existing.linkedChangeRequests) {
      await this.prisma.changeRequest.updateMany({
        where: { id: crId, ...(tenantId ? { tenantId } : {}) },
        data: { status: ChangeRequestStatus.RELEASED, linkedReleaseId: id }
      });
    }

    await writeAuditTrail(this.prisma, {
      entity: "SoftwareRelease",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      metadata: { event: "release_deployed" }
    });
    return updated;
  }

  async rollback(id: string, dto: RollbackReleaseDto) {
    if (!this.canManage()) throw new ForbiddenException("You do not have permission to manage releases");
    const tenantId = this.requireTenantId();
    const existing = await this.prisma.softwareRelease.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!existing) throw new NotFoundException("Release not found");
    const updated = await this.prisma.softwareRelease.update({
      where: { id },
      data: { status: ReleaseStatus.ROLLED_BACK, rollbackReason: sanitizeOperationsText(dto.reason) }
    });
    await writeAuditTrail(this.prisma, {
      entity: "SoftwareRelease",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "post-go-live",
      reason: dto.reason,
      metadata: { event: "release_rolled_back" }
    });
    return updated;
  }

  async latestVersion() {
    const tenantId = this.requireTenantId();
    return this.prisma.softwareRelease.findFirst({
      where: { ...(tenantId ? { tenantId } : {}), status: ReleaseStatus.DEPLOYED },
      orderBy: { deployedAt: "desc" }
    });
  }
}
