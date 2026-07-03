import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, ErpReconciliationMismatchStatus, Prisma, RoleName } from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import type { ErpListQueryDto, ReconciliationActionDto } from "./dto/erp.dto";

const REPORT_TYPES = [
  "employees",
  "vendors",
  "spare_parts",
  "stock_balances",
  "assets_vehicles",
  "invoices",
  "work_order_costs"
] as const;

@Injectable()
export class ErpReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = requestContext.get();
    return { actorId: c?.actorId, actorRole: c?.actorRole, permissions: c?.permissions ?? [], tenantId: c?.tenantId };
  }

  canView() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("erp.view") || permissions.includes("erp.reconcile") || permissions.includes("erp.manage");
  }

  canReconcile() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("erp.reconcile") || permissions.includes("erp.manage");
  }

  private tenantId(): string {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN && tenantId) return tenantId;
    if (!tenantId) throw new BadRequestException("Tenant context is required");
    return tenantId;
  }

  async ensureSampleMismatches(tenantId: string) {
    const count = await this.prisma.erpReconciliationMismatch.count({ where: { tenantId } });
    if (count > 0) return;
    await this.prisma.erpReconciliationMismatch.createMany({
      data: [
        {
          tenantId,
          reportType: "spare_parts",
          sourceRecordCode: "SP-001",
          fieldName: "quantity",
          erpValue: "10",
          maintainProValue: "8",
          mismatchType: "QUANTITY_DIFF",
          severity: "HIGH",
          suggestedAction: "Review stock count before any apply"
        },
        {
          tenantId,
          reportType: "employees",
          sourceRecordCode: "EMP-001",
          fieldName: "departmentId",
          erpValue: "Maintenance",
          maintainProValue: "Operations",
          mismatchType: "FIELD_DIFF",
          severity: "MEDIUM",
          suggestedAction: "Verify department mapping"
        }
      ]
    });
  }

  async findAll(query: ErpListQueryDto) {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view reconciliation");
    const tenantId = this.tenantId();
    await this.ensureSampleMismatches(tenantId);
    const where: Prisma.ErpReconciliationMismatchWhereInput = { tenantId };
    if (query.reportType) where.reportType = query.reportType;
    if (query.status) where.status = query.status as ErpReconciliationMismatchStatus;
    return this.prisma.erpReconciliationMismatch.findMany({ where, orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view reconciliation");
    const row = await this.prisma.erpReconciliationMismatch.findFirst({ where: { id, tenantId: this.tenantId() } });
    if (!row) throw new NotFoundException("Reconciliation mismatch not found");
    return row;
  }

  private async transition(id: string, status: ErpReconciliationMismatchStatus, event: string, dto: ReconciliationActionDto) {
    if (!this.canReconcile()) throw new ForbiddenException("You do not have permission to reconcile ERP data");
    const existing = await this.findOne(id);
    if (status === ErpReconciliationMismatchStatus.ACCEPTED && !dto.reason?.trim()) {
      throw new BadRequestException("Accepting mismatch requires reason");
    }
    const updated = await this.prisma.erpReconciliationMismatch.update({
      where: { id },
      data: {
        status,
        reviewedByUserId: this.ctx().actorId ?? undefined,
        maintainProValue: dto.correctedValue ?? existing.maintainProValue
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "ErpReconciliationMismatch",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "erp-integration",
      reason: dto.reason,
      metadata: { event, status } as Prisma.InputJsonValue,
      beforeData: existing as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  review = (id: string, dto: ReconciliationActionDto) =>
    this.transition(id, ErpReconciliationMismatchStatus.REVIEWED, "erp_reconciliation_reviewed", dto);

  accept = (id: string, dto: ReconciliationActionDto) =>
    this.transition(id, ErpReconciliationMismatchStatus.ACCEPTED, "erp_mismatch_accepted", dto);

  markCorrected = (id: string, dto: ReconciliationActionDto) =>
    this.transition(id, ErpReconciliationMismatchStatus.CORRECTED, "erp_mismatch_corrected", dto);

  async countOpen() {
    const tenantId = this.tenantId();
    await this.ensureSampleMismatches(tenantId);
    return this.prisma.erpReconciliationMismatch.count({
      where: { tenantId, status: ErpReconciliationMismatchStatus.OPEN }
    });
  }

  getReportTypes() {
    return REPORT_TYPES;
  }
}
