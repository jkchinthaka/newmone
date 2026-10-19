import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  Prisma,
  RoleName,
  VendorApprovalLevel,
  VendorInvoiceStatus,
  VendorQuotationStatus,
  VendorRepairStatus,
  WorkOrderStatus,
  WorkOrderVerificationStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { deriveTaxRatePercent, resolveVendorTaxLine, type VendorTaxLine } from "../../common/utils/vendor-tax";
import {
  assertInvoiceAttachment,
  assertInvoiceWithinQuotation,
  assertPositiveAmount,
  assertQuotationRequired,
  assertSupervisorVerifiedForInvoice,
  calculateCostVariance,
  invoiceIsFinanceApproved,
  isHighCostVendorRepair,
  quotationIsApproved,
  resolveVendorApprovalLevel,
  roleCanApproveVendorLevel,
  roleCanFinanceApprove,
  VENDOR_HIGH_COST_QUOTATIONS_REQUIRED
} from "../../common/utils/vendor-repair-governance";
import { PrismaService } from "../../database/prisma.service";
import { evaluateVendorEligibility } from "../policies/governance-policies";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

const FINANCE_ROLES = new Set<RoleName>([RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGER, RoleName.OPERATIONS_MANAGER]);
const VENDOR_REQUEST_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER,
  RoleName.SUPERVISOR
]);

@Injectable()
export class VendorRepairService {
  constructor(private readonly prisma: PrismaService) {}

  async getVendorRepair(workOrderId: string, actor?: Actor) {
    const workOrder = await this.findWorkOrder(workOrderId, actor);
    const vendorCase = await this.prisma.vendorRepairCase.findUnique({
      where: { workOrderId },
      include: {
        supplier: true,
        quotations: { orderBy: { createdAt: "desc" } },
        invoices: { orderBy: { createdAt: "desc" } }
      }
    });

    const partsCost = await this.prisma.workOrderPart.aggregate({
      where: { workOrderId },
      _sum: { totalCost: true }
    });

    const decorated = await this.decorateTax(vendorCase, workOrder.tenantId);
    const approvedQuotation = decorated.vendorCase?.quotations.find((q) => quotationIsApproved(q.status)) as
      | { quotedAmount: unknown; totalAmount?: number | null }
      | undefined;
    const latestInvoice = decorated.vendorCase?.invoices[0];
    const approvedRaw =
      decorated.vendorCase?.approvedQuotationAmount ??
      approvedQuotation?.totalAmount ??
      approvedQuotation?.quotedAmount;
    const approvedTotal = approvedRaw == null ? null : Number(approvedRaw);
    const costSummary = calculateCostVariance(approvedTotal, Number(latestInvoice?.totalAmount ?? 0));

    return {
      workOrderId,
      workOrderStatus: workOrder.status,
      verificationStatus: workOrder.verificationStatus,
      defaultTaxRatePercent: decorated.defaultTaxRatePercent,
      vendorCase: decorated.vendorCase,
      costSummary: {
        ...costSummary,
        partsCost: partsCost._sum.totalCost ?? 0,
        laborCost: workOrder.actualCost ?? 0,
        totalMaintenanceCost: (partsCost._sum.totalCost ?? 0) + (latestInvoice?.totalAmount ?? 0) + (workOrder.actualCost ?? 0)
      }
    };
  }

  async requestVendorRepair(
    workOrderId: string,
    body: { externalRepairReason: string; supplierId?: string; isEmergency?: boolean; overrideReason?: string },
    actor: Actor
  ) {
    this.assertCanRequest(actor);
    if (!body.externalRepairReason?.trim()) {
      throw new BadRequestException("Vendor repair request requires a reason.");
    }

    const workOrder = await this.findWorkOrder(workOrderId, actor);
    if (body.supplierId) {
      await this.assertSupplierSelectable(body.supplierId, actor, body.overrideReason);
    }

    const status = body.isEmergency
      ? body.overrideReason?.trim()
        ? VendorRepairStatus.EMERGENCY_VENDOR_REPAIR
        : VendorRepairStatus.MANAGER_OVERRIDE_REQUIRED
      : VendorRepairStatus.VENDOR_REPAIR_REQUESTED;

    if (body.isEmergency && !body.overrideReason?.trim()) {
      throw new BadRequestException("Emergency vendor repair requires override reason.");
    }

    const vendorCase = await this.prisma.vendorRepairCase.upsert({
      where: { workOrderId },
      create: {
        tenantId: workOrder.tenantId,
        workOrderId,
        supplierId: body.supplierId ?? null,
        status,
        externalRepairReason: body.externalRepairReason.trim(),
        emergencyOverride: Boolean(body.isEmergency),
        emergencyOverrideReason: body.overrideReason?.trim() || null,
        emergencyOverrideById: body.isEmergency ? actor.sub : null,
        requestedById: actor.sub,
        requestedAt: new Date()
      },
      update: {
        supplierId: body.supplierId ?? undefined,
        status,
        externalRepairReason: body.externalRepairReason.trim(),
        emergencyOverride: Boolean(body.isEmergency),
        emergencyOverrideReason: body.overrideReason?.trim() || null,
        requestedById: actor.sub,
        requestedAt: new Date()
      }
    });

    await this.recordAudit({
      event: body.isEmergency ? "emergency_vendor_override" : "vendor_repair_requested",
      actor,
      workOrderId,
      vendorId: body.supplierId,
      vendorRepairCaseId: vendorCase.id,
      reason: body.externalRepairReason,
      metadata: { status, overrideReason: body.overrideReason ?? null }
    });

    return this.getVendorRepair(workOrderId, actor);
  }

  async selectVendor(workOrderId: string, supplierId: string, overrideReason: string | undefined, actor: Actor) {
    this.assertCanRequest(actor);
    await this.assertSupplierSelectable(supplierId, actor, overrideReason);
    const vendorCase = await this.requireCase(workOrderId, actor);

    const updated = await this.prisma.vendorRepairCase.update({
      where: { id: vendorCase.id },
      data: { supplierId, status: VendorRepairStatus.QUOTATION_REQUIRED }
    });

    await this.recordAudit({
      event: "vendor_selected",
      actor,
      workOrderId,
      vendorId: supplierId,
      vendorRepairCaseId: updated.id
    });

    return this.getVendorRepair(workOrderId, actor);
  }

  async addQuotation(
    workOrderId: string,
    body: {
      supplierId: string;
      quotationNo: string;
      quotationDate: string;
      quotedAmount: number;
      taxRatePercent?: number | null;
      taxAmount?: number;
      currency?: string;
      validityDate?: string;
      evidenceAttachmentId?: string;
    },
    actor: Actor
  ) {
    this.assertCanRequest(actor);
    assertPositiveAmount("Quotation amount", body.quotedAmount);
    const vendorCase = await this.requireCase(workOrderId, actor);
    const tax = this.taxLine(body.quotedAmount, body);
    const level = resolveVendorApprovalLevel(tax.totalAmount);

    const quotation = await this.prisma.vendorQuotation.create({
      data: {
        tenantId: vendorCase.tenantId,
        vendorRepairCaseId: vendorCase.id,
        workOrderId,
        supplierId: body.supplierId,
        quotationNo: body.quotationNo.trim(),
        quotationDate: new Date(body.quotationDate),
        quotedAmount: body.quotedAmount,
        currency: body.currency ?? "LKR",
        validityDate: body.validityDate ? new Date(body.validityDate) : null,
        evidenceAttachmentId: body.evidenceAttachmentId ?? null,
        status: VendorQuotationStatus.SUBMITTED,
        submittedById: actor.sub,
        submittedAt: new Date(),
        requiredApprovalLevel: level
      }
    });

    await this.storeQuotationTax(quotation.id, tax);

    await this.prisma.vendorRepairCase.update({
      where: { id: vendorCase.id },
      data: { status: VendorRepairStatus.QUOTATION_SUBMITTED, supplierId: body.supplierId }
    });

    await this.recordAudit({
      event: "quotation_submitted",
      actor,
      workOrderId,
      vendorId: body.supplierId,
      quotationId: quotation.id,
      amount: tax.totalAmount,
      metadata: { approvalLevel: level }
    });

    return this.getVendorRepair(workOrderId, actor);
  }

  async approveQuotation(workOrderId: string, quotationId: string, approvalNote: string | undefined, actor: Actor) {
    const quotation = await this.findQuotation(workOrderId, quotationId, actor);
    const payable = await this.quotationPayableAmount(quotationId, Number(quotation.quotedAmount));
    const level = quotation.requiredApprovalLevel ?? resolveVendorApprovalLevel(payable);
    if (!roleCanApproveVendorLevel(actor.role, level)) {
      throw new ForbiddenException("Manager approval required.");
    }
    if (quotation.submittedById === actor.sub && !this.isAdmin(actor)) {
      throw new BadRequestException("Same user cannot request and approve vendor repair unless admin override.");
    }

    if (isHighCostVendorRepair(payable)) {
      const approvedCount = await this.prisma.vendorQuotation.count({
        where: { workOrderId, status: VendorQuotationStatus.APPROVED }
      });
      if (approvedCount + 1 < VENDOR_HIGH_COST_QUOTATIONS_REQUIRED && !this.isAdmin(actor)) {
        throw new BadRequestException("High-cost quotation requires finance approval.");
      }
    }

    await this.prisma.vendorQuotation.update({
      where: { id: quotationId },
      data: {
        status: VendorQuotationStatus.APPROVED,
        approvedById: actor.sub,
        approvedAt: new Date(),
        approvalNote: approvalNote?.trim() || null
      }
    });

    await this.prisma.vendorRepairCase.update({
      where: { id: quotation.vendorRepairCaseId },
      data: {
        status: VendorRepairStatus.QUOTATION_APPROVED,
        approvedQuotationAmount: payable,
        approvedQuotationId: quotationId
      }
    });

    await this.recordAudit({
      event: "quotation_approved",
      actor,
      workOrderId,
      quotationId,
      amount: payable,
      note: approvalNote
    });

    return this.getVendorRepair(workOrderId, actor);
  }

  async rejectQuotation(workOrderId: string, quotationId: string, reason: string, actor: Actor) {
    if (!reason?.trim()) throw new BadRequestException("Rejection reason is required.");
    const quotation = await this.findQuotation(workOrderId, quotationId, actor);
    if (!roleCanApproveVendorLevel(actor.role, quotation.requiredApprovalLevel ?? VendorApprovalLevel.MANAGER)) {
      throw new ForbiddenException("You cannot reject this quotation.");
    }

    await this.prisma.vendorQuotation.update({
      where: { id: quotationId },
      data: { status: VendorQuotationStatus.REJECTED, rejectionReason: reason.trim() }
    });

    await this.recordAudit({ event: "quotation_rejected", actor, workOrderId, quotationId, reason });
    return this.getVendorRepair(workOrderId, actor);
  }

  async authorizeVendorWork(workOrderId: string, overrideReason: string | undefined, actor: Actor) {
    this.assertCanRequest(actor);
    const vendorCase = await this.requireCase(workOrderId, actor);
    const approved = await this.prisma.vendorQuotation.findFirst({
      where: { vendorRepairCaseId: vendorCase.id, status: VendorQuotationStatus.APPROVED }
    });

    assertQuotationRequired(vendorCase.status, Boolean(approved), vendorCase.emergencyOverride, overrideReason);

    const updated = await this.prisma.vendorRepairCase.update({
      where: { id: vendorCase.id },
      data: {
        status: VendorRepairStatus.VENDOR_WORK_AUTHORIZED,
        authorizedById: actor.sub,
        authorizedAt: new Date()
      }
    });

    await this.recordAudit({
      event: "vendor_work_authorized",
      actor,
      workOrderId,
      vendorRepairCaseId: updated.id,
      reason: overrideReason
    });

    return this.getVendorRepair(workOrderId, actor);
  }

  async markVendorCompleted(workOrderId: string, actor: Actor) {
    this.assertCanRequest(actor);
    const vendorCase = await this.requireCase(workOrderId, actor);
    if (vendorCase.status !== VendorRepairStatus.VENDOR_WORK_AUTHORIZED && vendorCase.status !== VendorRepairStatus.VENDOR_IN_PROGRESS && vendorCase.status !== VendorRepairStatus.SENT_TO_VENDOR) {
      throw new BadRequestException("Vendor work must be authorized before marking vendor completed.");
    }

    await this.prisma.vendorRepairCase.update({
      where: { id: vendorCase.id },
      data: { status: VendorRepairStatus.VENDOR_COMPLETED, vendorCompletedAt: new Date() }
    });

    await this.recordAudit({ event: "vendor_work_completed", actor, workOrderId, vendorRepairCaseId: vendorCase.id });
    return this.getVendorRepair(workOrderId, actor);
  }

  async submitInvoice(
    workOrderId: string,
    body: {
      supplierId: string;
      invoiceNo: string;
      invoiceDate: string;
      invoiceAmount: number;
      taxRatePercent?: number | null;
      taxAmount?: number;
      currency?: string;
      evidenceAttachmentId?: string;
      exceedsQuotationReason?: string;
    },
    actor: Actor
  ) {
    this.assertCanRequest(actor);
    assertPositiveAmount("Invoice amount", body.invoiceAmount);
    const vendorCase = await this.requireCase(workOrderId, actor);
    const tax = this.taxLine(body.invoiceAmount, body);
    const totalAmount = tax.totalAmount;

    const duplicate = await this.prisma.vendorInvoice.findFirst({
      where: { tenantId: requireTenantId(vendorCase.tenantId), supplierId: body.supplierId, invoiceNo: body.invoiceNo.trim() }
    });
    if (duplicate) {
      throw new BadRequestException("Duplicate vendor invoice detected.");
    }

    assertInvoiceWithinQuotation(totalAmount, vendorCase.approvedQuotationAmount, body.exceedsQuotationReason);

    const invoice = await this.prisma.vendorInvoice.create({
      data: {
        tenantId: vendorCase.tenantId,
        vendorRepairCaseId: vendorCase.id,
        workOrderId,
        supplierId: body.supplierId,
        invoiceNo: body.invoiceNo.trim(),
        invoiceDate: new Date(body.invoiceDate),
        invoiceAmount: body.invoiceAmount,
        taxAmount: tax.taxAmount,
        totalAmount,
        currency: body.currency ?? "LKR",
        evidenceAttachmentId: body.evidenceAttachmentId ?? null,
        status: VendorInvoiceStatus.SUBMITTED,
        submittedById: actor.sub,
        submittedAt: new Date(),
        exceedsQuotationReason: body.exceedsQuotationReason?.trim() || null
      }
    });

    await this.storeInvoiceRate(invoice.id, tax.taxRatePercent);

    await this.prisma.vendorRepairCase.update({
      where: { id: vendorCase.id },
      data: { status: VendorRepairStatus.INVOICE_SUBMITTED }
    });

    await this.recordAudit({
      event: "invoice_submitted",
      actor,
      workOrderId,
      vendorId: body.supplierId,
      invoiceId: invoice.id,
      amount: totalAmount
    });

    return this.getVendorRepair(workOrderId, actor);
  }

  async approveInvoice(workOrderId: string, invoiceId: string, financeNote: string | undefined, actor: Actor) {
    if (!roleCanFinanceApprove(actor.role)) {
      throw new ForbiddenException("Finance approval required for high-cost vendor repair.");
    }

    const workOrder = await this.findWorkOrder(workOrderId, actor);
    const vendorCase = await this.requireCase(workOrderId, actor);
    const invoice = await this.findInvoice(workOrderId, invoiceId, actor);

    assertSupervisorVerifiedForInvoice({
      workOrderStatus: workOrder.status,
      verificationStatus: workOrder.verificationStatus,
      vendorRepairStatus: vendorCase.status
    });
    assertInvoiceAttachment(invoice.evidenceAttachmentId);

    if (invoice.submittedById === actor.sub && !this.isAdmin(actor)) {
      throw new BadRequestException("Same user cannot submit and finance-approve the same vendor repair.");
    }

    await this.prisma.vendorInvoice.update({
      where: { id: invoiceId },
      data: {
        status: VendorInvoiceStatus.APPROVED,
        financeApprovedById: actor.sub,
        financeApprovedAt: new Date(),
        financeNote: financeNote?.trim() || null
      }
    });

    await this.prisma.vendorRepairCase.update({
      where: { id: vendorCase.id },
      data: { status: VendorRepairStatus.FINANCE_APPROVED }
    });

    await this.recordAudit({ event: "finance_approved", actor, workOrderId, invoiceId, note: financeNote, amount: invoice.totalAmount });
    return this.getVendorRepair(workOrderId, actor);
  }

  async rejectInvoice(workOrderId: string, invoiceId: string, reason: string, actor: Actor) {
    if (!reason?.trim()) throw new BadRequestException("Rejection reason is required.");
    if (!roleCanFinanceApprove(actor.role)) throw new ForbiddenException("Finance role required.");

    await this.findInvoice(workOrderId, invoiceId, actor);
    await this.prisma.vendorInvoice.update({
      where: { id: invoiceId },
      data: { status: VendorInvoiceStatus.REJECTED, rejectionReason: reason.trim() }
    });

    await this.recordAudit({ event: "invoice_rejected", actor, workOrderId, invoiceId, reason });
    return this.getVendorRepair(workOrderId, actor);
  }

  async closeVendorRepair(workOrderId: string, overrideReason: string | undefined, actor: Actor) {
    const vendorCase = await this.requireCase(workOrderId, actor);
    const workOrder = await this.findWorkOrder(workOrderId, actor);
    const approvedInvoice = await this.prisma.vendorInvoice.findFirst({
      where: { vendorRepairCaseId: vendorCase.id, status: { in: [VendorInvoiceStatus.APPROVED, VendorInvoiceStatus.PAID] } }
    });

    if (!approvedInvoice && !vendorCase.emergencyOverride && !overrideReason?.trim()) {
      throw new BadRequestException("Vendor repair cannot close without invoice + supervisor verification.");
    }

    if (workOrder.verificationStatus !== WorkOrderVerificationStatus.VERIFIED && !overrideReason?.trim() && !this.isAdmin(actor)) {
      throw new BadRequestException("Supervisor verification required before closing vendor repair.");
    }

    await this.prisma.vendorRepairCase.update({
      where: { id: vendorCase.id },
      data: { status: VendorRepairStatus.CLOSED, closedAt: new Date() }
    });

    await this.recordAudit({ event: "vendor_repair_closed", actor, workOrderId, reason: overrideReason });
    return this.getVendorRepair(workOrderId, actor);
  }

  private assertCanRequest(actor: Actor) {
    if (!VENDOR_REQUEST_ROLES.has(actor.role as RoleName) && !this.isAdmin(actor)) {
      throw new ForbiddenException("You do not have permission to manage vendor repairs.");
    }
  }

  private isAdmin(actor: Actor) {
    return actor.role === RoleName.SUPER_ADMIN || actor.role === RoleName.ADMIN;
  }

  private async assertSupplierSelectable(supplierId: string, actor: Actor, overrideReason?: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: requireTenantId(actor?.tenantId) }
    });
    if (!supplier) throw new NotFoundException("Vendor not found.");
    const contracts = await this.prisma.vendorContract.findMany({
      where: { tenantId: supplier.tenantId, supplierId: supplier.id, isActive: true },
      select: { startDate: true, endDate: true, isActive: true, reminderDays: true }
    });
    const decision = evaluateVendorEligibility({
      tenantId: supplier.tenantId,
      active: supplier.isActive,
      blacklisted: supplier.blacklisted,
      insuranceRequired: supplier.insuranceRequired,
      insuranceExpiresAt: supplier.insuranceExpiresAt,
      contracts
    });
    const blocked = decision.reasons.filter((reason) => reason.blocksAssignment);
    const blacklistOnly = blocked.length > 0 && blocked.every((reason) => reason.code === "VENDOR_BLOCKED");
    if (blacklistOnly && overrideReason?.trim() && this.isAdmin(actor)) return;
    if (!decision.assignmentAllowed) {
      throw new BadRequestException({
        code: "VENDOR_NOT_ASSIGNABLE",
        message: blocked.map((reason) => reason.message).join(" "),
        reasons: blocked
      });
    }
  }

  private async findWorkOrder(workOrderId: string, actor?: Actor) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId: requireTenantId(actor?.tenantId) }
    });
    if (!wo) throw new NotFoundException("Work order not found");
    return wo;
  }

  private async requireCase(workOrderId: string, actor?: Actor) {
    const vendorCase = await this.prisma.vendorRepairCase.findUnique({ where: { workOrderId } });
    if (!vendorCase) throw new BadRequestException("Vendor repair has not been requested for this work order.");
    if (vendorCase.tenantId !== requireTenantId(actor?.tenantId)) {
      throw new NotFoundException("Vendor repair case not found");
    }
    return vendorCase;
  }

  private async findQuotation(workOrderId: string, quotationId: string, actor?: Actor) {
    const quotation = await this.prisma.vendorQuotation.findFirst({
      where: { id: quotationId, workOrderId, tenantId: requireTenantId(actor?.tenantId) }
    });
    if (!quotation) throw new NotFoundException("Quotation not found");
    return quotation;
  }

  private async findInvoice(workOrderId: string, invoiceId: string, actor?: Actor) {
    const invoice = await this.prisma.vendorInvoice.findFirst({
      where: { id: invoiceId, workOrderId, tenantId: requireTenantId(actor?.tenantId) }
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return invoice;
  }

  private async recordAudit(payload: {
    event: string;
    actor?: Actor;
    workOrderId: string;
    vendorId?: string;
    vendorRepairCaseId?: string;
    quotationId?: string;
    invoiceId?: string;
    amount?: number;
    reason?: string;
    note?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const ctx = requestContext.get();
    await this.prisma.auditLog.create({
      data: {
        tenantId: payload.actor?.tenantId ?? ctx?.tenantId ?? null,
        actorId: payload.actor?.sub ?? ctx?.actorId ?? null,
        module: "maintenance",
        entity: "VendorRepair",
        entityId: payload.vendorRepairCaseId ?? payload.workOrderId,
        action: AuditAction.UPDATE,
        reason: payload.reason ?? payload.note,
        metadata: {
          event: payload.event,
          workOrderId: payload.workOrderId,
          vendorId: payload.vendorId ?? null,
          quotationId: payload.quotationId ?? null,
          invoiceId: payload.invoiceId ?? null,
          amount: payload.amount ?? null,
          ...(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {})
        } as Prisma.InputJsonValue
      }
    });
  }

  private taxLine(baseAmount: number, input: { taxRatePercent?: unknown; taxAmount?: unknown }) {
    const resolved = resolveVendorTaxLine(baseAmount, input);
    if (!resolved.ok) throw new BadRequestException(resolved.message);
    return resolved.line;
  }

  private async storeQuotationTax(id: string, line: VendorTaxLine) {
    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE VendorQuotation SET taxRatePercent = ${line.taxRatePercent}, taxAmount = ${line.taxAmount}, totalAmount = ${line.totalAmount} WHERE id = ${id}`
    );
  }

  private async storeInvoiceRate(id: string, rate: number | null) {
    if (rate === null) return;
    await this.prisma.$executeRaw(Prisma.sql`UPDATE VendorInvoice SET taxRatePercent = ${rate} WHERE id = ${id}`);
  }

  private async quotationPayableAmount(quotationId: string, quotedAmount: number) {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ totalAmount: unknown }>>(
        Prisma.sql`SELECT totalAmount FROM VendorQuotation WHERE id = ${quotationId}`
      );
      const total = rows[0]?.totalAmount;
      if (total === null || total === undefined) return quotedAmount;
      const amount = Number(total);
      return Number.isFinite(amount) ? amount : quotedAmount;
    } catch {
      return quotedAmount;
    }
  }

  private async decorateTax<
    TQuotation extends { id: string; quotedAmount: unknown },
    TInvoice extends { id: string; invoiceAmount: unknown; taxAmount: unknown },
    TCase extends { id: string; quotations: TQuotation[]; invoices: TInvoice[] }
  >(vendorCase: TCase | null, tenantId: string) {
    let defaultTaxRatePercent: number | null = null;
    let quotationRates = new Map<string, { taxRatePercent: number | null; taxAmount: number | null; totalAmount: number | null }>();
    let invoiceRates = new Map<string, number | null>();
    try {
      const settings = await this.prisma.$queryRaw<Array<{ defaultTaxRatePercent: unknown }>>(
        Prisma.sql`SELECT TOP 1 defaultTaxRatePercent FROM TenantMaintenanceSetting WHERE tenantId = ${tenantId}`
      );
      if (settings[0]?.defaultTaxRatePercent != null) {
        const rate = Number(settings[0].defaultTaxRatePercent);
        defaultTaxRatePercent = Number.isFinite(rate) ? rate : null;
      }
      if (vendorCase) {
        const quotations = await this.prisma.$queryRaw<
          Array<{ id: string; taxRatePercent: unknown; taxAmount: unknown; totalAmount: unknown }>
        >(Prisma.sql`SELECT id, taxRatePercent, taxAmount, totalAmount FROM VendorQuotation WHERE vendorRepairCaseId = ${vendorCase.id}`);
        quotationRates = new Map(
          quotations.map((row) => [
            row.id,
            {
              taxRatePercent: row.taxRatePercent == null ? null : Number(row.taxRatePercent),
              taxAmount: row.taxAmount == null ? null : Number(row.taxAmount),
              totalAmount: row.totalAmount == null ? null : Number(row.totalAmount)
            }
          ])
        );
        const invoices = await this.prisma.$queryRaw<Array<{ id: string; taxRatePercent: unknown }>>(
          Prisma.sql`SELECT id, taxRatePercent FROM VendorInvoice WHERE vendorRepairCaseId = ${vendorCase.id}`
        );
        invoiceRates = new Map(invoices.map((row) => [row.id, row.taxRatePercent == null ? null : Number(row.taxRatePercent)]));
      }
    } catch {
      defaultTaxRatePercent = null;
    }

    if (!vendorCase) return { vendorCase, defaultTaxRatePercent };

    const quotations: Array<
      TQuotation & {
        taxRatePercent: number | null;
        taxAmount: number | null;
        totalAmount: number | null;
        displayTaxRatePercent: number | null;
      }
    > = vendorCase.quotations.map((quotation) => {
      const stored = quotationRates.get(quotation.id);
      const base = Number(quotation.quotedAmount);
      const taxAmount = stored?.taxAmount ?? null;
      return {
        ...quotation,
        taxRatePercent: stored?.taxRatePercent ?? null,
        taxAmount,
        totalAmount: stored?.totalAmount ?? null,
        displayTaxRatePercent: stored?.taxRatePercent ?? (taxAmount == null ? null : deriveTaxRatePercent(base, taxAmount))
      };
    });
    const invoices = vendorCase.invoices.map((invoice) => {
      const stored = invoiceRates.get(invoice.id) ?? null;
      const base = Number(invoice.invoiceAmount);
      const taxAmount = Number(invoice.taxAmount);
      return {
        ...invoice,
        taxRatePercent: stored,
        displayTaxRatePercent: stored ?? deriveTaxRatePercent(base, taxAmount)
      };
    });

    return {
      defaultTaxRatePercent,
      vendorCase: { ...vendorCase, quotations, invoices }
    };
  }
}
