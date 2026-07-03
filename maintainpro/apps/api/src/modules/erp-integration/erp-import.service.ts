import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, ErpImportBatchStatus, Prisma, RoleName } from "@prisma/client";
import { ConfigService } from "@nestjs/config";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { resolveErpSyncMode } from "./connectors/erp-connectors";
import type { CreateImportBatchDto, ImportActionDto } from "./dto/erp.dto";

type ParsedRow = { rowNumber: number; values: Record<string, string>; valid: boolean; errors: string[] };

@Injectable()
export class ErpImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private ctx() {
    const c = requestContext.get();
    return { actorId: c?.actorId, actorRole: c?.actorRole, permissions: c?.permissions ?? [], tenantId: c?.tenantId };
  }

  canView() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("erp.view") || permissions.includes("erp.import") || permissions.includes("erp.manage");
  }

  canImport() {
    const { actorRole, permissions } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN || actorRole === RoleName.ADMIN) return true;
    return permissions.includes("erp.import") || permissions.includes("erp.manage");
  }

  private tenantId(): string {
    const { tenantId, actorRole } = this.ctx();
    if (actorRole === RoleName.SUPER_ADMIN && tenantId) return tenantId;
    if (!tenantId) throw new BadRequestException("Tenant context is required");
    return tenantId;
  }

  private assertImportMode() {
    const mode = resolveErpSyncMode(this.configService);
    if (mode !== "file_import" && mode !== "mock") {
      throw new BadRequestException("File import requires ERP_SYNC_MODE=file_import or mock for testing");
    }
  }

  private parseCsv(content: string): ParsedRow[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    const seen = new Set<string>();
    return lines.slice(1).map((line, idx) => {
      const cols = line.split(",").map((c) => c.trim());
      const values: Record<string, string> = {};
      headers.forEach((h, i) => {
        values[h] = cols[i] ?? "";
      });
      const errors: string[] = [];
      const code = values.itemCode || values.employeeCode || values.vendorCode || values.invoiceNo || values.poNumber;
      if (!code) errors.push("Missing primary code field");
      let duplicate = false;
      if (code) {
        const key = code.toLowerCase();
        if (seen.has(key)) {
          duplicate = true;
          errors.push("Duplicate row detected");
        }
        seen.add(key);
      }
      return { rowNumber: idx + 2, values, valid: errors.length === 0 && !duplicate, errors };
    });
  }

  private async nextBatchNo(tenantId: string) {
    const count = await this.prisma.erpImportBatch.count({ where: { tenantId } });
    return `IMP-${String(count + 1).padStart(5, "0")}`;
  }

  async findAll() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view import batches");
    return this.prisma.erpImportBatch.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(id: string) {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view import batches");
    const batch = await this.prisma.erpImportBatch.findFirst({ where: { id, tenantId: this.tenantId() } });
    if (!batch) throw new NotFoundException("Import batch not found");
    return batch;
  }

  async createBatch(dto: CreateImportBatchDto) {
    if (!this.canImport()) throw new ForbiddenException("You do not have permission to import ERP data");
    this.assertImportMode();
    const tenantId = this.tenantId();
    const parsed = this.parseCsv(dto.csvContent);
    const validRows = parsed.filter((r) => r.valid).length;
    const invalidRows = parsed.filter((r) => !r.valid && !r.errors.includes("Duplicate row detected")).length;
    const duplicateRows = parsed.filter((r) => r.errors.includes("Duplicate row detected")).length;

    const batch = await this.prisma.erpImportBatch.create({
      data: {
        tenantId,
        batchNo: await this.nextBatchNo(tenantId),
        importType: dto.importType,
        fileName: dto.fileName,
        status: ErpImportBatchStatus.UPLOADED,
        totalRows: parsed.length,
        validRows,
        invalidRows,
        duplicateRows,
        uploadedByUserId: this.ctx().actorId ?? undefined
      }
    });

    await writeAuditTrail(this.prisma, {
      entity: "ErpImportBatch",
      entityId: batch.id,
      action: AuditAction.CREATE,
      module: "erp-integration",
      metadata: { event: "erp_import_batch_uploaded", batchNo: batch.batchNo } as Prisma.InputJsonValue
    });

    return { batch, parsedPreview: parsed.slice(0, 20) };
  }

  async dryRun(id: string) {
    if (!this.canImport()) throw new ForbiddenException("You do not have permission to import ERP data");
    const batch = await this.findOne(id);
    const summary = {
      wouldCreate: batch.validRows,
      wouldUpdate: 0,
      wouldSkip: batch.invalidRows + batch.duplicateRows,
      note: "Dry-run only — no production inventory/finance data modified"
    };
    const updated = await this.prisma.erpImportBatch.update({
      where: { id },
      data: {
        status: ErpImportBatchStatus.READY_FOR_REVIEW,
        dryRunSummary: summary as Prisma.InputJsonValue
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "ErpImportBatch",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "erp-integration",
      metadata: { event: "erp_import_dry_run_completed", summary } as Prisma.InputJsonValue
    });
    return updated;
  }

  async approve(id: string, dto: ImportActionDto) {
    if (!this.canImport()) throw new ForbiddenException("You do not have permission to approve imports");
    const batch = await this.findOne(id);
    if (batch.status !== ErpImportBatchStatus.READY_FOR_REVIEW) {
      throw new BadRequestException("Batch must complete dry-run before approval");
    }
    const updated = await this.prisma.erpImportBatch.update({
      where: { id },
      data: { status: ErpImportBatchStatus.APPROVED, approvedByUserId: this.ctx().actorId ?? undefined }
    });
    await writeAuditTrail(this.prisma, {
      entity: "ErpImportBatch",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "erp-integration",
      reason: dto.reason,
      metadata: { event: "erp_import_approved" } as Prisma.InputJsonValue
    });
    return updated;
  }

  async apply(id: string, dto: ImportActionDto) {
    if (!this.canImport()) throw new ForbiddenException("You do not have permission to apply imports");
    const batch = await this.findOne(id);
    if (batch.status !== ErpImportBatchStatus.APPROVED) {
      throw new BadRequestException("Import batch must be approved before apply");
    }
    const applySummary = {
      applied: false,
      message: "Staging-only apply recorded — production master data not modified in UAT-029",
      validRows: batch.validRows
    };
    const updated = await this.prisma.erpImportBatch.update({
      where: { id },
      data: {
        status: ErpImportBatchStatus.IMPORTED,
        applySummary: applySummary as Prisma.InputJsonValue
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "ErpImportBatch",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "erp-integration",
      reason: dto.reason,
      metadata: { event: "erp_import_applied", stagingOnly: true } as Prisma.InputJsonValue
    });
    return updated;
  }

  async cancel(id: string, dto: ImportActionDto) {
    if (!this.canImport()) throw new ForbiddenException("You do not have permission to cancel imports");
    await this.findOne(id);
    const updated = await this.prisma.erpImportBatch.update({
      where: { id },
      data: { status: ErpImportBatchStatus.CANCELLED }
    });
    await writeAuditTrail(this.prisma, {
      entity: "ErpImportBatch",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "erp-integration",
      reason: dto.reason,
      metadata: { event: "erp_import_cancelled" } as Prisma.InputJsonValue
    });
    return updated;
  }
}
