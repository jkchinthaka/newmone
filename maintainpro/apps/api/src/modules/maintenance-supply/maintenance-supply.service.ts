import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional
} from "@nestjs/common";
import {
  ApprovalProcessType,
  ApprovalRequestStatus,
  ApprovalTrigger,
  ComplianceRequirementStatus,
  SparePartClassification,
  VendorContractStatus,
  VendorContractType,
  WorkOrderExecutionMode
} from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { ApprovalsService } from "../approvals/approvals.service";
import { InventoryTransactionEngine } from "../inventory/inventory-transaction.engine";
import { evaluateComplianceStatus } from "../planning/compliance-status";
import {
  computeWorkOrderTotalCost,
  contractExpiryStatus,
  resolveStockSourceBoundary,
  type WoCostBreakdown
} from "./supply-boundary";

type Actor = Pick<JwtPayload, "sub" | "tenantId">;

function contractTypeToComplianceKey(type: VendorContractType): string {
  switch (type) {
    case VendorContractType.AMC:
      return "AMC";
    case VendorContractType.REPAIR_WARRANTY:
      return "REPAIR_WARRANTY";
    case VendorContractType.SERVICE:
    case VendorContractType.OTHER:
    default:
      return "SERVICE_AGREEMENT";
  }
}

function mapContractExpiryToStatus(
  key: "ACTIVE" | "EXPIRING" | "EXPIRED"
): VendorContractStatus {
  if (key === "EXPIRED") return VendorContractStatus.EXPIRED;
  if (key === "EXPIRING") return VendorContractStatus.EXPIRING;
  return VendorContractStatus.ACTIVE;
}

@Injectable()
export class MaintenanceSupplyService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly stockEngine?: InventoryTransactionEngine,
    @Optional() private readonly approvalsService?: ApprovalsService
  ) {}

  stockBoundaryForPart(
    part: { erpCode?: string | null },
    opts?: { erpSyncEnabled?: boolean; productionMode?: boolean; mockSync?: boolean }
  ) {
    return resolveStockSourceBoundary({
      erpCode: part.erpCode,
      erpSyncEnabled: opts?.erpSyncEnabled,
      productionMode: opts?.productionMode,
      mockSync: opts?.mockSync
    });
  }

  computeConsumption(issue: { quantity: number; quantityReturned?: number | null }): number {
    return Math.max(0, Number(issue.quantity || 0) - Number(issue.quantityReturned || 0));
  }

  async listPartsMapping(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const parts = await this.prisma.sparePart.findMany({
      where: { tenantId, isActive: true },
      orderBy: { partNumber: "asc" },
      take: 500,
      select: {
        id: true,
        partNumber: true,
        name: true,
        classification: true,
        erpCode: true,
        maintenanceAlias: true,
        maintenanceCategory: true,
        criticalSpare: true,
        referenceStock: true,
        quantityInStock: true,
        availableQuantity: true
      }
    });
    return parts.map((p) => ({
      ...p,
      mapped: Boolean(p.erpCode),
      stockBoundary: this.stockBoundaryForPart(p)
    }));
  }

  async listOutstandingTools(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const issues = await this.prisma.partIssue.findMany({
      where: {
        tenantId,
        OR: [
          { expectsReturn: true },
          { part: { classification: SparePartClassification.TOOL } }
        ]
      },
      include: {
        part: {
          select: {
            id: true,
            partNumber: true,
            name: true,
            classification: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return issues
      .filter((i) => this.computeConsumption(i) > 0)
      .map((i) => ({
        ...i,
        outstandingQuantity: this.computeConsumption(i)
      }));
  }

  async getWorkOrderCost(actor: Actor, workOrderId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: { costSnapshot: true }
    });
    if (!wo) throw new NotFoundException("Work order not found");
    const live = await this.buildCostBreakdownFromWo(workOrderId);
    return {
      workOrderId,
      snapshot: wo.costSnapshot,
      liveBreakdown: live,
      liveTotal: computeWorkOrderTotalCost(live)
    };
  }

  async buildCostBreakdownFromWo(workOrderId: string): Promise<WoCostBreakdown> {
    const [issues, labour, invoices] = await Promise.all([
      this.prisma.partIssue.findMany({ where: { workOrderId } }),
      this.prisma.workOrderLabourEntry.findMany({ where: { workOrderId } }),
      this.prisma.vendorInvoice.findMany({ where: { workOrderId } })
    ]);

    const partsCost = issues.reduce((sum, issue) => {
      const consumed = this.computeConsumption(issue);
      return sum + consumed * Number(issue.unitCostSnapshot ?? 0);
    }, 0);

    const internalLabourCost = labour.reduce((sum, entry) => {
      const hours = Number(entry.durationMinutes ?? 0) / 60;
      return sum + hours * Number(entry.labourRateSnapshot ?? 0);
    }, 0);

    const externalServiceCost = invoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount ?? inv.invoiceAmount ?? 0),
      0
    );

    return {
      partsCost,
      internalLabourCost,
      externalServiceCost,
      transportCost: 0,
      otherCost: 0
    };
  }

  async snapshotWorkOrderCosts(
    actor: Actor,
    workOrderId: string,
    breakdown?: Partial<WoCostBreakdown> | null,
    notes?: string
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId }
    });
    if (!wo) {
      throw new NotFoundException("Work order not found");
    }

    const existing = await this.prisma.workOrderCostSnapshot.findUnique({
      where: { workOrderId }
    });
    if (existing) {
      // Historical snapshot is immutable once taken.
      return existing;
    }

    const auto =
      breakdown == null ||
      (breakdown.partsCost == null &&
        breakdown.internalLabourCost == null &&
        breakdown.externalServiceCost == null &&
        breakdown.transportCost == null &&
        breakdown.otherCost == null)
        ? await this.buildCostBreakdownFromWo(workOrderId)
        : null;

    const resolved: WoCostBreakdown = {
      partsCost: Number(breakdown?.partsCost ?? auto?.partsCost ?? 0),
      internalLabourCost: Number(
        breakdown?.internalLabourCost ?? auto?.internalLabourCost ?? 0
      ),
      externalServiceCost: Number(
        breakdown?.externalServiceCost ?? auto?.externalServiceCost ?? 0
      ),
      transportCost: Number(breakdown?.transportCost ?? auto?.transportCost ?? 0),
      otherCost: Number(breakdown?.otherCost ?? auto?.otherCost ?? 0)
    };

    const totalCost = computeWorkOrderTotalCost(resolved);
    const snapshot = await this.prisma.workOrderCostSnapshot.create({
      data: {
        tenantId,
        workOrderId,
        partsCost: resolved.partsCost,
        internalLabourCost: resolved.internalLabourCost,
        externalServiceCost: resolved.externalServiceCost,
        transportCost: resolved.transportCost,
        otherCost: resolved.otherCost,
        totalCost,
        snappedById: actor.sub,
        notes,
        lineItems: resolved as object
      }
    });

    await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { actualCost: totalCost }
    });

    return snapshot;
  }

  async autoSnapshotWorkOrderCosts(actor: Actor, workOrderId: string, notes?: string) {
    return this.snapshotWorkOrderCosts(actor, workOrderId, null, notes);
  }

  async setExecutionMode(actor: Actor, workOrderId: string, mode: WorkOrderExecutionMode) {
    const tenantId = requireTenantId(actor.tenantId);
    const wo = await this.prisma.workOrder.findFirst({ where: { id: workOrderId, tenantId } });
    if (!wo) throw new NotFoundException("Work order not found");
    return this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { executionMode: mode }
    });
  }

  async returnToolIssue(
    actor: Actor,
    issueId: string,
    input: { quantityReturned: number; notes?: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const qty = Number(input.quantityReturned);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException("quantityReturned must be a positive number");
    }

    const issue = await this.prisma.partIssue.findFirst({
      where: { id: issueId, tenantId },
      include: { part: true }
    });
    if (!issue) throw new NotFoundException("Part issue not found");
    if (!issue.expectsReturn && issue.part.classification !== SparePartClassification.TOOL) {
      throw new BadRequestException("Issue does not expect a tool return");
    }
    const nextReturned = issue.quantityReturned + qty;
    if (nextReturned > issue.quantity) {
      throw new BadRequestException("Returned quantity exceeds issued quantity");
    }

    const updated = await this.prisma.partIssue.update({
      where: { id: issueId },
      data: {
        quantityReturned: nextReturned,
        returnedAt: nextReturned >= issue.quantity ? new Date() : issue.returnedAt,
        returnedById: actor.sub,
        returnNotes: input.notes,
        expectsReturn: true
      }
    });

    if (this.stockEngine) {
      await this.stockEngine.returnStock({
        actor,
        partId: issue.partId,
        quantity: qty,
        warehouseId: issue.warehouseId ?? undefined,
        workOrderId: issue.workOrderId,
        notes: input.notes ?? "Tool/part return",
        sourceType: "PART_ISSUE_RETURN",
        sourceDocument: `part-issue:${issueId}`,
        idempotencyKey: `part-return:${issueId}:${nextReturned}`
      });
    }

    return updated;
  }

  async createVendorContract(
    actor: Actor,
    input: {
      supplierId: string;
      contractNo: string;
      contractType?: VendorContractType;
      title: string;
      coverage?: string;
      slaSummary?: string;
      visitCount?: number;
      assetIds?: string[];
      siteIds?: string[];
      startDate: Date;
      endDate: Date;
      valueReference?: number;
      documentUrls?: string[];
      reminderDays?: number;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: input.supplierId, tenantId }
    });
    if (!supplier) throw new NotFoundException("Vendor not found");

    const contractType = input.contractType ?? VendorContractType.AMC;
    const reminderDays = input.reminderDays ?? 30;
    const statusKey = contractExpiryStatus({
      endDate: input.endDate,
      reminderDays
    });
    const status = mapContractExpiryToStatus(statusKey);
    const typeKey = contractTypeToComplianceKey(contractType);
    const complianceStatus = evaluateComplianceStatus({
      expiresAt: input.endDate,
      reminderDays
    }) as ComplianceRequirementStatus;

    return this.prisma.$transaction(async (tx) => {
      const compliance = await tx.complianceRequirement.create({
        data: {
          tenantId,
          typeKey,
          subjectType: "SUPPLIER",
          subjectId: input.supplierId,
          title: input.title,
          issuedAt: input.startDate,
          expiresAt: input.endDate,
          reminderDays,
          status: complianceStatus,
          providerName: supplier.name,
          isActive: true,
          metadata: {
            source: "VENDOR_CONTRACT",
            contractNo: input.contractNo,
            contractType
          }
        }
      });

      return tx.vendorContract.create({
        data: {
          tenantId,
          supplierId: input.supplierId,
          contractNo: input.contractNo,
          contractType,
          status,
          title: input.title,
          coverage: input.coverage,
          slaSummary: input.slaSummary,
          visitCount: input.visitCount,
          assetIds: input.assetIds ?? [],
          siteIds: input.siteIds ?? [],
          startDate: input.startDate,
          endDate: input.endDate,
          valueReference: input.valueReference,
          documentUrls: input.documentUrls ?? [],
          reminderDays,
          complianceRequirementId: compliance.id,
          notes: input.notes
        }
      });
    });
  }

  async refreshContractStatuses(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const contracts = await this.prisma.vendorContract.findMany({
      where: { tenantId, isActive: true, status: { in: ["ACTIVE", "EXPIRING", "DRAFT"] } },
      take: 500
    });
    const updates = [];
    for (const c of contracts) {
      const key = contractExpiryStatus({
        endDate: c.endDate,
        reminderDays: c.reminderDays
      });
      const status = mapContractExpiryToStatus(key);
      const complianceStatus = evaluateComplianceStatus({
        expiresAt: c.endDate,
        reminderDays: c.reminderDays
      }) as ComplianceRequirementStatus;

      if (status !== c.status) {
        updates.push(
          this.prisma.vendorContract.update({ where: { id: c.id }, data: { status } })
        );
      }
      if (c.complianceRequirementId) {
        updates.push(
          this.prisma.complianceRequirement.update({
            where: { id: c.complianceRequirementId },
            data: { status: complianceStatus, expiresAt: c.endDate, reminderDays: c.reminderDays }
          })
        );
      }
    }
    return Promise.all(updates);
  }

  async assignVendorToWorkOrder(
    actor: Actor,
    workOrderId: string,
    supplierId: string,
    executionMode: WorkOrderExecutionMode = WorkOrderExecutionMode.EXTERNAL
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const [wo, supplier] = await Promise.all([
      this.prisma.workOrder.findFirst({ where: { id: workOrderId, tenantId } }),
      this.prisma.supplier.findFirst({ where: { id: supplierId, tenantId, isActive: true } })
    ]);
    if (!wo) throw new NotFoundException("Work order not found");
    if (!supplier) throw new NotFoundException("Vendor not found");

    if (this.approvalsService) {
      const result = await this.approvalsService.ensureApprovalRequired({
        actor,
        processType: ApprovalProcessType.VENDOR_REPAIR,
        trigger: ApprovalTrigger.BEFORE_ASSIGN_VENDOR,
        subjectEntityType: "WorkOrder",
        subjectEntityId: workOrderId,
        context: {
          processType: ApprovalProcessType.VENDOR_REPAIR,
          priority: wo.priority,
          workType: wo.type,
          estimatedCost: wo.estimatedCost,
          actualCost: wo.actualCost,
          siteId: wo.siteId,
          departmentId: wo.departmentId,
          domainId: wo.domainId,
          status: wo.status,
          executionType: "EXTERNAL"
        }
      });

      if (result.configError) {
        throw new BadRequestException(result.configError);
      }

      if (
        result.required &&
        (result.status === ApprovalRequestStatus.PENDING ||
          result.status === ApprovalRequestStatus.EMERGENCY_OVERRIDE_PENDING_REVIEW)
      ) {
        throw new BadRequestException({
          message: "Vendor assignment requires approval",
          code: "APPROVAL_REQUIRED",
          approvalRequestId: result.approvalRequestId,
          processType: ApprovalProcessType.VENDOR_REPAIR
        });
      }
    }

    return this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        executionMode,
        vendorSupplierId: supplierId,
        notes: [wo.notes, `Vendor assigned: ${supplier.name} (${supplier.id})`]
          .filter(Boolean)
          .join("\n")
      }
    });
  }

  async mapErpItem(actor: Actor, partId: string, erpCode: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const code = erpCode.trim();
    if (!code) throw new BadRequestException("erpCode is required");

    const part = await this.prisma.sparePart.findFirst({ where: { id: partId, tenantId } });
    if (!part) throw new NotFoundException("Spare part not found");

    const conflict = await this.prisma.sparePart.findFirst({
      where: { tenantId, erpCode: code, NOT: { id: partId } }
    });
    if (conflict) {
      throw new BadRequestException(`ERP code already mapped to part ${conflict.partNumber}`);
    }

    return this.prisma.sparePart.update({
      where: { id: partId },
      data: { erpCode: code }
    });
  }

  async mapWarehouse(actor: Actor, warehouseId: string, erpWarehouseCode: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const code = erpWarehouseCode.trim();
    if (!code) throw new BadRequestException("erpWarehouseCode is required");

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId }
    });
    if (!warehouse) throw new NotFoundException("Warehouse not found");

    return this.prisma.warehouse.update({
      where: { id: warehouseId },
      data: {
        erpWarehouseCode: code,
        lastErpValidatedAt: new Date()
      }
    });
  }
}
