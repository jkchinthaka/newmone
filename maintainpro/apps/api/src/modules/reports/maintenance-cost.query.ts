import { BadRequestException, Injectable } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { businessDayBound } from "./report-timezone.util";
import {
  centsToAmount,
  inBusinessDateRange,
  rollupMaintenanceCost,
  varianceAgainstEstimate,
  type LabourLine,
  type PartsLine,
  type ServiceLine
} from "./maintenance-cost.rollup";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

const RATE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "FINANCE"]);

@Injectable()
export class MaintenanceCostQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: Actor,
    query: {
      startDate?: string;
      endDate?: string;
      search?: string;
      status?: string;
      workOrderId?: string;
      vendorId?: string;
      page?: string;
      pageSize?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException("startDate and endDate are required (YYYY-MM-DD).");
    }
    const start = businessDayBound(query.startDate, "start");
    const end = businessDayBound(query.endDate, "end");
    if (start.getTime() > end.getTime()) throw new BadRequestException("startDate must not be after endDate.");
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(5000, Math.max(1, Number(query.pageSize ?? 25) || 25));
    const orders = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        ...(query.workOrderId ? { id: query.workOrderId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { woNumber: { contains: query.search } },
                { title: { contains: query.search } },
                { asset: { name: { contains: query.search } } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        woNumber: true,
        title: true,
        status: true,
        estimatedCost: true,
        asset: { select: { name: true } },
        site: { select: { name: true } },
        functionalLocation: { select: { name: true } },
        parts: {
          select: { id: true, issuedQuantity: true, returnedQuantity: true, unitCost: true, issuedAt: true }
        },
        labourEntries: {
          select: { id: true, durationMinutes: true, correctedDurationMinutes: true, labourRateSnapshot: true, startedAt: true, endedAt: true }
        }
      },
      orderBy: [{ woNumber: "asc" }, { id: "asc" }]
    });
    const invoices = orders.length
      ? await this.prisma.vendorInvoice.findMany({
          where: { tenantId, workOrderId: { in: orders.map((order) => order.id) } },
          select: { id: true, workOrderId: true, status: true, totalAmount: true, currency: true, financeApprovedAt: true, supplierId: true }
        })
      : [];
    const invoicesByOrder = new Map<string, typeof invoices>();
    for (const invoice of invoices) {
      const rows = invoicesByOrder.get(invoice.workOrderId) ?? [];
      rows.push(invoice);
      invoicesByOrder.set(invoice.workOrderId, rows);
    }

    const showRates = RATE_ROLES.has(String(actor.role));
    const jobs = orders
      .map((order) => {
        const periodParts = order.parts.filter((line) => inBusinessDateRange(line.issuedAt, start, end));
        const periodLabour = order.labourEntries.filter((line) => line.endedAt && inBusinessDateRange(line.endedAt, start, end));
        const orderInvoices = invoicesByOrder.get(order.id) ?? [];
        const periodServices = orderInvoices.filter(
          (line) =>
            (line.status === "APPROVED" || line.status === "PAID") &&
            inBusinessDateRange(line.financeApprovedAt, start, end) &&
            (!query.vendorId || line.supplierId === query.vendorId)
        );
        if (query.vendorId && periodServices.length === 0) return null;
        const period = rollupMaintenanceCost({
          parts: periodParts.map(toPart),
          labour: periodLabour.map(toLabour),
          services: periodServices.map(toService)
        });
        const lifetime = rollupMaintenanceCost({
          parts: order.parts.map(toPart),
          labour: order.labourEntries.filter((line) => line.endedAt).map(toLabour),
          services: orderInvoices.filter((line) => !query.vendorId || line.supplierId === query.vendorId).map(toService)
        });
        const open = !["CLOSED", "CANCELLED", "COMPLETED"].includes(order.status);
        for (const line of order.labourEntries) {
          if (line.endedAt) continue;
          if (inBusinessDateRange(line.startedAt, start, end)) {
            period.unvalued.push(`labour-open:${line.id}`);
            period.complete = false;
          }
          lifetime.unvalued.push(`labour-open:${line.id}`);
          lifetime.complete = false;
        }
        const periodActivity = periodParts.length + periodLabour.length + periodServices.length + period.unvalued.length;
        if (periodActivity === 0 && period.unvalued.length === 0) return null;
        return {
          id: order.id,
          woNumber: order.woNumber,
          title: order.title,
          status: order.status,
          asset: order.asset?.name ?? order.functionalLocation?.name ?? order.site?.name ?? null,
          period,
          lifetime: {
            actual: lifetime.actual,
            complete: lifetime.complete,
            variance: varianceAgainstEstimate(lifetime.actualCents, order.estimatedCost?.toString() ?? null, open)
          },
          lines: showRates
            ? { parts: periodParts.length, labour: periodLabour.length, services: periodServices.length }
            : { parts: periodParts.length, labour: periodLabour.length, services: periodServices.length, ratesHidden: true }
        };
      })
      .filter((job): job is NonNullable<typeof job> => Boolean(job));

    const summaryCents = jobs.reduce(
      (sum, job) => ({
        parts: sum.parts + job.period.partsCents,
        labour: sum.labour + job.period.labourCents,
        services: sum.services + job.period.serviceCents
      }),
      { parts: 0, labour: 0, services: 0 }
    );
    const pageRows = jobs.slice((page - 1) * pageSize, page * pageSize);
    return {
      items: pageRows,
      summary: {
        parts: centsToAmount(summaryCents.parts),
        labour: centsToAmount(summaryCents.labour),
        services: centsToAmount(summaryCents.services),
        actual: centsToAmount(summaryCents.parts + summaryCents.labour + summaryCents.services),
        incompleteJobs: jobs.filter((job) => !job.period.complete).length,
        currency: "LKR",
        taxBasis: "Stored invoice totalAmount; tax is not added again.",
        dateBasis: "Parts use issuedAt, labour uses endedAt, services use financeApprovedAt, Asia/Colombo.",
        vendorFilter: "Recognized service invoices for the selected supplier. Parts and labour on those jobs stay included."
      },
      page,
      pageSize,
      total: jobs.length,
      evaluatedAt: new Date().toISOString()
    };
  }
}

function toPart(line: { id: string; issuedQuantity: number; returnedQuantity: number; unitCost: { toString(): string } | null; issuedAt: Date | null }): PartsLine {
  return { id: line.id, issuedQuantity: line.issuedQuantity, returnedQuantity: line.returnedQuantity, unitCost: line.unitCost?.toString() ?? null, issuedAt: line.issuedAt };
}

function toLabour(line: {
  id: string;
  durationMinutes: number | null;
  correctedDurationMinutes: number | null;
  labourRateSnapshot: { toString(): string } | null;
  endedAt: Date | null;
}): LabourLine {
  return {
    id: line.id,
    durationMinutes: line.correctedDurationMinutes ?? line.durationMinutes,
    labourRateSnapshot: line.labourRateSnapshot?.toString() ?? null,
    endedAt: line.endedAt
  };
}

function toService(line: {
  id: string;
  status: string;
  totalAmount: { toString(): string };
  currency: string;
  financeApprovedAt: Date | null;
}): ServiceLine {
  return { id: line.id, status: line.status, totalAmount: line.totalAmount.toString(), currency: line.currency, financeApprovedAt: line.financeApprovedAt };
}
