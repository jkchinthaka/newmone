import { BadRequestException, Injectable } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import {
  ApprovalDecisionOutcome,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  MaintenanceRequestStatus,
  PartRequestStatus,
  VendorInvoiceStatus,
  VendorQuotationStatus,
  VendorRepairStatus
} from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { ApprovalsService } from "./approvals.service";
import {
  ageLabel,
  asRecord,
  assertAmountWithinRole,
  assertExpectedVersion,
  assertKindPermission,
  assertNotOwnRequest,
  assertSameBulkKind,
  inboxTab,
  readAmount,
  slaTone,
  versionFromDate,
  withApprovalIdempotency,
  type InboxKind,
  type InboxTab
} from "./approval-inbox.rules";

type Actor = {
  sub: string;
  email?: string;
  role?: string;
  tenantId?: string | null;
  permissions?: string[];
};

function withEmail(actor: Actor) {
  return { ...actor, email: actor.email ?? "", role: actor.role ?? "VIEWER" };
}

export type InboxDecision = "APPROVED" | "REJECTED" | "RETURNED";

export type InboxRow = {
  id: string;
  kind: InboxKind;
  tab: Exclude<InboxTab, "all">;
  reference: string;
  title: string;
  requesterName: string;
  requesterId: string | null;
  assetLabel: string | null;
  amount: number | null;
  taxRatePercent: number | null;
  priority: string | null;
  siteId: string | null;
  requestedAt: string;
  age: string;
  sla: "green" | "amber" | "red";
  version: number;
  canDecide: boolean;
  canReturn: boolean;
  workOrderId: string | null;
  partStage: "OPERATIONAL" | "FINANCE" | null;
  processType: string | null;
  subjectEntityType: string | null;
  subjectEntityId: string | null;
  status: string;
  attachments: Array<{ id: string; label: string }>;
  history: Array<{ at: string; label: string; reason?: string | null }>;
};

const OPERATIONS_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "SUPERVISOR",
  "ASSET_MANAGER",
  "FACILITY_MANAGER",
  "FINANCE"
]);

@Injectable()
export class ApprovalInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
    private readonly moduleRef: ModuleRef
  ) {}

  async list(actor: Actor, query: {
    tab?: string;
    search?: string;
    priority?: string;
    siteId?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const tenantId = this.tenant(actor);
    const rows = await this.collect(actor, tenantId);
    const counts = {
      all: rows.length,
      requests: 0,
      work_orders: 0,
      parts: 0,
      vendor_quotations: 0,
      vendor_invoices: 0,
      emergency: 0
    };
    for (const row of rows) counts[row.tab] += 1;

    const search = query.search?.trim().toLowerCase();
    const from = query.from ? new Date(query.from).getTime() : null;
    const to = query.to ? new Date(`${query.to}T23:59:59.999`).getTime() : null;
    const filtered = rows.filter((row) => {
      if (query.tab && query.tab !== "all" && row.tab !== query.tab) return false;
      if (query.priority && row.priority !== query.priority) return false;
      if (query.siteId && row.siteId !== query.siteId) return false;
      const at = new Date(row.requestedAt).getTime();
      if (from != null && at < from) return false;
      if (to != null && at > to) return false;
      if (!search) return true;
      const hay = `${row.reference} ${row.title} ${row.requesterName}`.toLowerCase();
      return hay.includes(search);
    });
    filtered.sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());

    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(100, query.pageSize && query.pageSize > 0 ? query.pageSize : 50);
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      meta: { page, pageSize, total: filtered.length, counts }
    };
  }

  async decide(input: {
    actor: Actor;
    id: string;
    kind: InboxKind;
    decision: InboxDecision;
    reason?: string;
    expectedVersion?: number;
    idempotencyKey?: string;
    workOrderId?: string | null;
  }) {
    const fingerprint = [input.kind, input.id, input.decision, input.reason ?? "", input.expectedVersion].join("|");
    return withApprovalIdempotency(input.idempotencyKey, fingerprint, async () => {
      assertKindPermission(input.actor, input.kind);
      if (input.decision !== "APPROVED" && (input.reason?.trim().length ?? 0) < 3) {
        throw new BadRequestException("A reason is required");
      }
      if (input.kind === "approval") {
        return this.approvals.decide({
          actor: input.actor,
          requestId: input.id,
          decision: input.decision === "RETURNED" ? "RETURNED" : (input.decision as ApprovalDecisionOutcome),
          reason: input.reason,
          expectedVersion: input.expectedVersion
        });
      }
      return this.decideOperational(input);
    });
  }

  async bulkApprove(input: {
    actor: Actor;
    items: Array<{ id: string; kind: InboxKind; expectedVersion: number; workOrderId?: string | null }>;
    idempotencyKey?: string;
  }) {
    assertSameBulkKind(input.items.map((item) => item.kind));
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const item of input.items) {
      try {
        assertAmountWithinRole(input.actor.role, await this.amountFor(input.actor, item));
        await this.decide({
          actor: input.actor,
          id: item.id,
          kind: item.kind,
          decision: "APPROVED",
          expectedVersion: item.expectedVersion,
          workOrderId: item.workOrderId,
          idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:${item.id}` : undefined
        });
        results.push({ id: item.id, ok: true });
      } catch (error) {
        results.push({ id: item.id, ok: false, error: error instanceof Error ? error.message : "Failed" });
      }
    }
    return { results };
  }

  private async amountFor(actor: Actor, item: { id: string; kind: InboxKind }) {
    const rows = await this.collect(actor, this.tenant(actor));
    return rows.find((row) => row.id === item.id && row.kind === item.kind)?.amount ?? null;
  }

  private async decideOperational(input: {
    actor: Actor;
    id: string;
    kind: InboxKind;
    decision: InboxDecision;
    reason?: string;
    expectedVersion?: number;
    workOrderId?: string | null;
  }) {
    const tenantId = this.tenant(input.actor);
    if (input.kind === "request") {
      const current = await this.prisma.maintenanceRequest.findFirst({ where: { id: input.id, tenantId } });
      if (!current) throw new BadRequestException("Request not found");
      assertNotOwnRequest(current.reportedById, input.actor.sub);
      assertExpectedVersion(versionFromDate(current.updatedAt), input.expectedVersion);
      const requests = await this.requests();
      if (input.decision === "APPROVED") return requests.approve(tenantId, input.id, input.actor);
      if (input.decision === "RETURNED") {
        return requests.requestInformation(tenantId, input.id, input.actor, { question: input.reason!.trim() });
      }
      return requests.reject(tenantId, input.id, input.actor, { reasonType: "OTHER", reason: input.reason!.trim() });
    }

    const workOrderId = input.workOrderId;
    if (!workOrderId) throw new BadRequestException("Work order is required for this decision");

    if (input.kind === "part") {
      const current = await this.prisma.partRequest.findFirst({ where: { id: input.id, tenantId } });
      if (!current) throw new BadRequestException("Part request not found");
      assertNotOwnRequest(current.requestedById, input.actor.sub);
      assertExpectedVersion(versionFromDate(current.updatedAt), input.expectedVersion);
      const amount = Number(current.unitCostSnapshot) * current.requestedQuantity;
      assertAmountWithinRole(input.actor.role, amount);
      const stage = current.status === PartRequestStatus.PENDING_FINANCE ? "FINANCE" : "OPERATIONAL";
      assertKindPermission(input.actor, "part", stage);
      if (input.decision === "RETURNED") {
        throw new BadRequestException("Return for information is only available for approval requests and maintenance requests");
      }
      const workOrders = await this.workOrders();
      if (input.decision === "REJECTED") {
        return workOrders.rejectPartRequest(workOrderId, input.id, { reason: input.reason!.trim(), stage }, withEmail(input.actor));
      }
      return stage === "FINANCE"
        ? workOrders.approvePartRequestFinance(workOrderId, input.id, { reason: input.reason }, withEmail(input.actor))
        : workOrders.approvePartRequestOperational(workOrderId, input.id, { reason: input.reason }, withEmail(input.actor));
    }

    if (input.kind === "vendor_quotation" || input.kind === "vendor_invoice") {
      const current =
        input.kind === "vendor_quotation"
          ? await this.prisma.vendorQuotation.findFirst({ where: { id: input.id, tenantId } })
          : await this.prisma.vendorInvoice.findFirst({ where: { id: input.id, tenantId } });
      if (!current) throw new BadRequestException("Vendor document not found");
      assertNotOwnRequest(current.submittedById, input.actor.sub);
      assertExpectedVersion(versionFromDate(current.updatedAt), input.expectedVersion);
      const amount = money(current, "totalAmount") ?? money(current, "quotedAmount");
      assertAmountWithinRole(input.actor.role, Number.isFinite(amount) ? amount : null);
      if (input.decision === "RETURNED") {
        throw new BadRequestException("Return for information is only available for approval requests and maintenance requests");
      }
      const vendor = await this.vendorRepair();
      if (input.kind === "vendor_quotation") {
        return input.decision === "APPROVED"
          ? vendor.approveQuotation(workOrderId, input.id, input.reason, withEmail(input.actor))
          : vendor.rejectQuotation(workOrderId, input.id, input.reason!.trim(), withEmail(input.actor));
      }
      return input.decision === "APPROVED"
        ? vendor.approveInvoice(workOrderId, input.id, input.reason, withEmail(input.actor))
        : vendor.rejectInvoice(workOrderId, input.id, input.reason!.trim(), withEmail(input.actor));
    }

    throw new BadRequestException("Review this emergency closure on the work order");
  }

  private async collect(actor: Actor, tenantId: string): Promise<InboxRow[]> {
    const viewAll =
      actor.role === "SUPER_ADMIN" ||
      actor.role === "ADMIN" ||
      (actor.permissions ?? []).includes("approvals.view_all");
    const seeOperations = viewAll || OPERATIONS_ROLES.has(actor.role ?? "");
    const now = new Date();

    const approvalWhere = {
      tenantId,
      status: { in: [ApprovalRequestStatus.PENDING, ApprovalRequestStatus.EMERGENCY_OVERRIDE_PENDING_REVIEW] },
      ...(viewAll
        ? {}
        : {
            steps: {
              some: {
                status: { in: [ApprovalStepStatus.PENDING, ApprovalStepStatus.ESCALATED] },
                OR: [{ assignedApproverId: actor.sub }, { backupApproverId: actor.sub }]
              }
            }
          })
    };

    const [approvals, requests, parts, quotations, invoices, emergencies] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where: approvalWhere,
        include: {
          requester: { select: { id: true, firstName: true, lastName: true } },
          steps: { orderBy: { level: "asc" } },
          decisions: { orderBy: { decidedAt: "asc" }, take: 8 }
        },
        take: 100,
        orderBy: { requestedAt: "asc" }
      }),
      seeOperations
        ? this.prisma.maintenanceRequest.findMany({
            where: { tenantId, status: { in: [MaintenanceRequestStatus.NEW, MaintenanceRequestStatus.UNDER_REVIEW] } },
            include: {
              reportedBy: { select: { firstName: true, lastName: true } },
              asset: { select: { name: true } },
              vehicle: { select: { registrationNo: true } }
            },
            take: 100,
            orderBy: { reportedAt: "asc" }
          })
        : [],
      seeOperations
        ? this.prisma.partRequest.findMany({
            where: {
              tenantId,
              status: { in: [PartRequestStatus.PENDING_OPERATIONAL, PartRequestStatus.PENDING_FINANCE] }
            },
            include: {
              requestedBy: { select: { firstName: true, lastName: true } },
              part: { select: { name: true } },
              workOrder: {
                select: {
                  woNumber: true,
                  title: true,
                  priority: true,
                  siteId: true,
                  asset: { select: { name: true } },
                  vehicle: { select: { registrationNo: true } }
                }
              }
            },
            take: 100,
            orderBy: { createdAt: "asc" }
          })
        : [],
      seeOperations
        ? this.prisma.vendorQuotation.findMany({
            where: { tenantId, status: VendorQuotationStatus.SUBMITTED },
            take: 100,
            orderBy: { createdAt: "asc" }
          })
        : [],
      seeOperations
        ? this.prisma.vendorInvoice.findMany({
            where: { tenantId, status: { in: [VendorInvoiceStatus.SUBMITTED, VendorInvoiceStatus.UNDER_REVIEW] } },
            take: 100,
            orderBy: { createdAt: "asc" }
          })
        : [],
      seeOperations
        ? this.prisma.vendorRepairCase.findMany({
            where: { tenantId, status: VendorRepairStatus.EMERGENCY_VENDOR_REPAIR },
            include: { workOrder: { select: { woNumber: true, title: true, priority: true, siteId: true } } },
            take: 50
          })
        : []
    ]);

    const workOrderIds = approvals
      .filter((item) => item.subjectEntityType === "WorkOrder")
      .map((item) => item.subjectEntityId);
    const workOrders = workOrderIds.length
      ? await this.prisma.workOrder.findMany({
          where: { tenantId, id: { in: workOrderIds } },
          select: {
            id: true,
            woNumber: true,
            title: true,
            priority: true,
            siteId: true,
            asset: { select: { name: true } },
            vehicle: { select: { registrationNo: true } }
          }
        })
      : [];
    const workOrderById = new Map(workOrders.map((item) => [item.id, item]));

    const rows: InboxRow[] = [];
    for (const item of approvals) {
      const context = asRecord(item.sourceContext);
      const workOrder = item.subjectEntityType === "WorkOrder" ? workOrderById.get(item.subjectEntityId) : undefined;
      const current = item.steps.find((step) => step.status === ApprovalStepStatus.PENDING || step.status === ApprovalStepStatus.ESCALATED);
      const requestedAt = item.requestedAt;
      const kind: InboxKind = "approval";
      rows.push({
        id: item.id,
        kind,
        tab: inboxTab({ kind, processType: item.processType, status: item.status }),
        reference: String(context?.reference ?? workOrder?.woNumber ?? item.subjectEntityId),
        title: String(context?.title ?? workOrder?.title ?? item.processType.replaceAll("_", " ")),
        requesterName: person(item.requester),
        requesterId: item.requesterId,
        assetLabel: workOrder?.asset?.name ?? workOrder?.vehicle?.registrationNo ?? null,
        amount: readAmount(context),
        taxRatePercent: numberOrNull(context?.taxRatePercent),
        priority: String(context?.priority ?? workOrder?.priority ?? "") || null,
        siteId: String(context?.siteId ?? workOrder?.siteId ?? "") || null,
        requestedAt: requestedAt.toISOString(),
        age: ageLabel(requestedAt, now.getTime()),
        sla: slaTone(requestedAt, current?.dueAt ?? null, now.getTime()),
        version: versionFromDate(item.updatedAt),
        canDecide: true,
        canReturn: true,
        workOrderId: item.subjectEntityType === "WorkOrder" ? item.subjectEntityId : null,
        partStage: null,
        processType: item.processType,
        subjectEntityType: item.subjectEntityType,
        subjectEntityId: item.subjectEntityId,
        status: item.status,
        attachments: [],
        history: item.decisions.map((decision) => ({
          at: decision.decidedAt.toISOString(),
          label: decision.decision,
          reason: decision.reason
        }))
      });
    }

    for (const item of requests) {
      rows.push(
        this.row({
          id: item.id,
          kind: "request",
          reference: item.requestNumber,
          title: item.description.slice(0, 120),
          requesterName: person(item.reportedBy),
          requesterId: item.reportedById,
          assetLabel: item.asset?.name ?? item.vehicle?.registrationNo ?? null,
          amount: null,
          taxRatePercent: null,
          priority: item.priority,
          siteId: item.siteId,
          requestedAt: item.reportedAt,
          dueAt: null,
          version: versionFromDate(item.updatedAt),
          canDecide: true,
          canReturn: true,
          workOrderId: null,
          partStage: null,
          status: item.status,
          now
        })
      );
    }

    for (const item of parts) {
      const amount = Number(item.unitCostSnapshot) * item.requestedQuantity;
      rows.push(
        this.row({
          id: item.id,
          kind: "part",
          reference: item.workOrder.woNumber,
          title: item.part.name,
          requesterName: person(item.requestedBy),
          requesterId: item.requestedById,
          assetLabel: item.workOrder.asset?.name ?? item.workOrder.vehicle?.registrationNo ?? null,
          amount: Number.isFinite(amount) ? amount : null,
          taxRatePercent: null,
          priority: item.workOrder.priority,
          siteId: item.workOrder.siteId,
          requestedAt: item.createdAt,
          dueAt: null,
          version: versionFromDate(item.updatedAt),
          canDecide: true,
          canReturn: false,
          workOrderId: item.workOrderId,
          partStage: item.status === PartRequestStatus.PENDING_FINANCE ? "FINANCE" : "OPERATIONAL",
          status: item.status,
          now
        })
      );
    }

    for (const item of quotations) {
      rows.push(
        this.row({
          id: item.id,
          kind: "vendor_quotation",
          reference: item.quotationNo,
          title: "Vendor quotation",
          requesterName: "Vendor",
          requesterId: item.submittedById,
          assetLabel: null,
          amount: money(item, "totalAmount") ?? money(item, "quotedAmount"),
          taxRatePercent: money(item, "taxRatePercent"),
          priority: null,
          siteId: null,
          requestedAt: item.submittedAt ?? item.createdAt,
          dueAt: null,
          version: versionFromDate(item.updatedAt),
          canDecide: true,
          canReturn: false,
          workOrderId: item.workOrderId,
          partStage: null,
          status: item.status,
          attachments: item.evidenceAttachmentId ? [{ id: item.evidenceAttachmentId, label: "Quotation file" }] : [],
          now
        })
      );
    }

    for (const item of invoices) {
      rows.push(
        this.row({
          id: item.id,
          kind: "vendor_invoice",
          reference: item.invoiceNo,
          title: "Vendor invoice",
          requesterName: "Vendor",
          requesterId: item.submittedById,
          assetLabel: null,
          amount: money(item, "totalAmount"),
          taxRatePercent: money(item, "taxRatePercent"),
          priority: null,
          siteId: null,
          requestedAt: item.submittedAt ?? item.createdAt,
          dueAt: null,
          version: versionFromDate(item.updatedAt),
          canDecide: true,
          canReturn: false,
          workOrderId: item.workOrderId,
          partStage: null,
          status: item.status,
          attachments: item.evidenceAttachmentId ? [{ id: item.evidenceAttachmentId, label: "Invoice file" }] : [],
          now
        })
      );
    }

    for (const item of emergencies) {
      rows.push(
        this.row({
          id: item.id,
          kind: "emergency",
          reference: item.workOrder.woNumber,
          title: item.workOrder.title,
          requesterName: "Emergency closure",
          requesterId: item.requestedById,
          assetLabel: null,
          amount: numberOrNull(item.approvedQuotationAmount),
          taxRatePercent: null,
          priority: item.workOrder.priority,
          siteId: item.workOrder.siteId,
          requestedAt: item.requestedAt ?? item.createdAt,
          dueAt: null,
          version: versionFromDate(item.updatedAt),
          canDecide: false,
          canReturn: false,
          workOrderId: item.workOrderId,
          partStage: null,
          status: item.status,
          now
        })
      );
    }

    return rows;
  }

  private row(input: {
    id: string;
    kind: InboxKind;
    reference: string;
    title: string;
    requesterName: string;
    requesterId: string | null;
    assetLabel: string | null;
    amount: number | null;
    taxRatePercent: number | null;
    priority: string | null;
    siteId: string | null;
    requestedAt: Date;
    dueAt: Date | null;
    version: number;
    canDecide: boolean;
    canReturn: boolean;
    workOrderId: string | null;
    partStage: "OPERATIONAL" | "FINANCE" | null;
    status: string;
    attachments?: Array<{ id: string; label: string }>;
    now: Date;
  }): InboxRow {
    return {
      id: input.id,
      kind: input.kind,
      tab: inboxTab({ kind: input.kind, status: input.status }),
      reference: input.reference,
      title: input.title,
      requesterName: input.requesterName,
      requesterId: input.requesterId,
      assetLabel: input.assetLabel,
      amount: input.amount,
      taxRatePercent: input.taxRatePercent,
      priority: input.priority,
      siteId: input.siteId,
      requestedAt: input.requestedAt.toISOString(),
      age: ageLabel(input.requestedAt, input.now.getTime()),
      sla: slaTone(input.requestedAt, input.dueAt, input.now.getTime()),
      version: input.version,
      canDecide: input.canDecide,
      canReturn: input.canReturn,
      workOrderId: input.workOrderId,
      partStage: input.partStage,
      processType: null,
      subjectEntityType: null,
      subjectEntityId: null,
      status: input.status,
      attachments: input.attachments ?? [],
      history: []
    };
  }

  private tenant(actor: Actor) {
    if (!actor.tenantId) throw new BadRequestException("Tenant context is required");
    return actor.tenantId;
  }

  private async workOrders() {
    const loaded = await import("../work-orders/work-orders.service.js");
    return this.moduleRef.get(loaded.WorkOrdersService, { strict: false });
  }

  private async vendorRepair() {
    const loaded = await import("../work-orders/vendor-repair.service.js");
    return this.moduleRef.get(loaded.VendorRepairService, { strict: false });
  }

  private async requests() {
    const loaded = await import("../maintenance-requests/maintenance-requests.service.js");
    return this.moduleRef.get(loaded.MaintenanceRequestsService, { strict: false });
  }
}

function person(user?: { firstName?: string | null; lastName?: string | null } | null) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return name || "Unknown";
}

function money(row: object, key: string): number | null {
  return numberOrNull((row as Record<string, unknown>)[key]);
}

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
