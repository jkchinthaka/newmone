import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { workOrderCost, workOrderSla, type SlaRuleMinutes } from "./work-order-insights";

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function labourMinutes(row: {
  correctedDurationMinutes?: number | null;
  durationMinutes?: number | null;
  startedAt: Date;
  endedAt?: Date | null;
}) {
  if (row.correctedDurationMinutes != null) return row.correctedDurationMinutes;
  if (row.durationMinutes != null) return row.durationMinutes;
  if (!row.endedAt) return null;
  return Math.max(0, Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 60_000));
}

@Injectable()
export class WorkOrderInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async forWorkOrder(tenantId: string | null | undefined, id: string, now = new Date()) {
    const tid = requireTenantId(tenantId);
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, tenantId: tid },
      select: { id: true, priority: true, createdAt: true, startDate: true, completedDate: true }
    });
    if (!workOrder) throw new NotFoundException("Work order not found");

    const owned = { workOrderId: id, OR: [{ tenantId: tid }, { tenantId: null }] };
    const [labour, parts, quotes, rules] = await Promise.all([
      this.prisma.workOrderLabourEntry.findMany({
        where: owned,
        select: {
          correctedDurationMinutes: true,
          durationMinutes: true,
          labourRateSnapshot: true,
          startedAt: true,
          endedAt: true
        }
      }),
      this.prisma.partIssue.findMany({
        where: owned,
        select: { quantity: true, quantityReturned: true, unitCostSnapshot: true }
      }),
      this.prisma.vendorRepairCase.findFirst({
        where: owned,
        select: { approvedQuotationAmount: true }
      }),
      this.prisma.prioritySlaRule.findMany({
        where: { tenantId: tid, active: true },
        select: { priority: true, responseMinutes: true, completionMinutes: true }
      })
    ]);

    const cost = workOrderCost({
      labour: labour.map((row) => ({ minutes: labourMinutes(row), rate: asNumber(row.labourRateSnapshot) })),
      parts: parts.map((row) => ({
        quantity: Math.max(0, row.quantity - row.quantityReturned),
        unitCost: asNumber(row.unitCostSnapshot)
      })),
      vendorTotals: quotes?.approvedQuotationAmount == null ? [] : [asNumber(quotes.approvedQuotationAmount)].filter((value): value is number => value != null)
    });
    const sla = workOrderSla({
      priority: workOrder.priority,
      createdAt: workOrder.createdAt,
      startedAt: workOrder.startDate,
      completedAt: workOrder.completedDate,
      now,
      rules: rules as SlaRuleMinutes[]
    });

    return { cost, sla };
  }
}
