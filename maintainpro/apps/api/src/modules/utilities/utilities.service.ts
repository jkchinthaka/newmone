import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { toJsonText } from "../../common/utils/json-text";
import { PrismaService } from "../../database/prisma.service";
import { comparableConsumptions, evaluateMeterReading, meterFractionDigits, parseStrictReadingValue } from "./meter-reading-rules";

@Injectable()
export class UtilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  meters(tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.utilityMeter.findMany({
      where: { tenantId: scopedTenantId },
      orderBy: { createdAt: "desc" }
    });
  }

  async meter(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    const meter = await this.prisma.utilityMeter.findFirst({
      where: { id, tenantId: scopedTenantId }
    });

    if (!meter) {
      throw new NotFoundException("Meter not found");
    }

    return meter;
  }

  createMeter(
    tenantId: string | null,
    data: { meterNumber: string; type: "ELECTRICITY" | "WATER" | "GAS"; location: string; description?: string; unit: string }
  ) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.utilityMeter.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async updateMeter(id: string, tenantId: string | null, data: Partial<{ location: string; description: string; unit: string; isActive: boolean }>) {
    await this.meter(id, tenantId);

    return this.prisma.utilityMeter.update({ where: { id }, data });
  }

  async addReading(
    id: string,
    tenantId: string | null,
    data: {
      readingDate: string;
      readingValue: unknown;
      images?: string[];
      notes?: string;
      resetReason?: string;
      idempotencyKey?: string;
      recordedBy?: string;
    }
  ) {
    const meter = await this.meter(id, tenantId);
    const parsed = parseStrictReadingValue(data.readingValue, meterFractionDigits(meter.unit, meter.type));
    if (!parsed.ok) throw new BadRequestException(parsed.message);
    const readingAt = new Date(data.readingDate);
    const idempotencyKey = data.idempotencyKey?.trim();
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (idempotencyKey) {
          const existingRows = await tx.meterReading.findMany({ where: { meterId: id } });
          const replay = existingRows.find((row) => String(row.notes ?? "").includes(`[idempotency:${idempotencyKey}]`));
          if (replay) {
            const samePayload = Number(replay.readingValue) === parsed.value && replay.readingDate.getTime() === readingAt.getTime();
            if (!samePayload) {
              throw new ConflictException("This idempotency key was already used for a different reading.");
            }
            return { ...replay, warning: null, replayed: true };
          }
        }
        const history = await tx.meterReading.findMany({
          where: { meterId: id },
          orderBy: { readingDate: "desc" },
          take: 8
        });
        if (history.some((row) => row.readingDate.getTime() === readingAt.getTime())) {
          throw new ConflictException("A reading already exists for this meter at that time.");
        }
        const previous = history[0];
        const decision = evaluateMeterReading({
          value: parsed.value,
          readingAt,
          now: new Date(),
          previousValue: previous ? Number(previous.readingValue) : null,
          recentConsumptions: comparableConsumptions(history),
          resetReason: data.resetReason
        });
        if (!decision.ok) throw new BadRequestException(decision.message);
        const noteParts = [
          idempotencyKey ? `[idempotency:${idempotencyKey}]` : "",
          data.recordedBy ? `[by:${data.recordedBy}]` : "",
          decision.reset ? `[reset:${data.resetReason?.trim()}]` : "",
          data.notes?.trim() ?? ""
        ].filter(Boolean);
        const created = await tx.meterReading.create({
          data: {
            meterId: id,
            readingDate: readingAt,
            readingValue: parsed.value,
            consumption: decision.consumption,
            images: toJsonText(data.images ?? []) ?? "[]",
            notes: noteParts.join(" ") || null
          }
        });
        return { ...created, warning: decision.warning, replayed: false };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.meterReading.findFirst({
          where: { meterId: id, readingDate: readingAt }
        });
        const sameReplay = existing && idempotencyKey && String(existing.notes ?? "").includes(`[idempotency:${idempotencyKey}]`) && Number(existing.readingValue) === parsed.value;
        if (sameReplay && existing) return { ...existing, warning: null, replayed: true };
        throw new ConflictException("A reading already exists for this meter at that time.");
      }
      throw error;
    }
  }

  async readings(id: string, tenantId: string | null) {
    await this.meter(id, tenantId);

    return this.prisma.meterReading.findMany({ where: { meterId: id }, orderBy: { readingDate: "desc" } });
  }

  async allReadings(tenantId: string | null) {
    // Scope to meters owned by this tenant, then fetch their readings. Avoids
    // Prisma's required-relation `include` throwing on dangling meterIds while
    // also enforcing tenant isolation (MeterReading has no tenantId of its own).
    const scopedTenantId = requireTenantId(tenantId);
    const meters = await this.prisma.utilityMeter.findMany({
      where: { tenantId: scopedTenantId }
    });
    if (meters.length === 0) return [];

    const meterMap = new Map(meters.map((m) => [m.id, m]));
    const readings = await this.prisma.meterReading.findMany({
      where: { meterId: { in: meters.map((m) => m.id) } },
      orderBy: { readingDate: "desc" }
    });

    return readings
      .filter((r) => meterMap.has(r.meterId))
      .map((r) => ({ ...r, meter: meterMap.get(r.meterId) }));
  }

  async consumptionChart(id: string, tenantId: string | null) {
    await this.meter(id, tenantId);

    const readings = await this.prisma.meterReading.findMany({
      where: { meterId: id },
      orderBy: { readingDate: "asc" }
    });

    return readings.map((item) => ({
      month: item.readingDate.toISOString().slice(0, 7),
      consumption: Number(item.consumption ?? 0)
    }));
  }

  async bills(tenantId: string | null) {
    // Same orphan-tolerant strategy as `allReadings`: avoid Prisma's required
    // relation include throwing on dangling meterIds.
    const scopedTenantId = requireTenantId(tenantId);
    const bills = await this.prisma.utilityBill.findMany({
      where: { tenantId: scopedTenantId },
      orderBy: { createdAt: "desc" }
    });
    if (bills.length === 0) return [];

    const meterIds = Array.from(new Set(bills.map((b) => b.meterId).filter(Boolean)));
    const meters = meterIds.length
      ? await this.prisma.utilityMeter.findMany({
          where: {
            id: { in: meterIds },
            tenantId: scopedTenantId
          }
        })
      : [];
    const meterMap = new Map(meters.map((m) => [m.id, m]));

    return bills.map((b) => ({ ...b, meter: meterMap.get(b.meterId) ?? null }));
  }

  async createBill(
    tenantId: string | null,
    data: {
      meterId: string;
      billingPeriodStart: string;
      billingPeriodEnd: string;
      totalConsumption: number;
      ratePerUnit: number;
      baseCharge?: number;
      taxAmount?: number;
      dueDate?: string;
      notes?: string;
    }
  ) {
    const scopedTenantId = requireTenantId(tenantId);
    // Cross-tenant FK validation: the referenced meter must belong to the tenant.
    await this.meter(data.meterId, scopedTenantId);

    const totalAmount = data.totalConsumption * data.ratePerUnit + (data.baseCharge ?? 0) + (data.taxAmount ?? 0);

    return this.prisma.utilityBill.create({
      data: {
        tenantId: scopedTenantId,
        meterId: data.meterId,
        billingPeriodStart: new Date(data.billingPeriodStart),
        billingPeriodEnd: new Date(data.billingPeriodEnd),
        totalConsumption: data.totalConsumption,
        ratePerUnit: data.ratePerUnit,
        baseCharge: data.baseCharge,
        taxAmount: data.taxAmount,
        totalAmount,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes
      }
    });
  }

  async bill(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    const bill = await this.prisma.utilityBill.findFirst({
      where: { id, tenantId: scopedTenantId },
      include: { meter: true }
    });

    if (!bill) {
      throw new NotFoundException("Bill not found");
    }

    return bill;
  }

  async payBill(id: string, tenantId: string | null) {
    await this.bill(id, tenantId);

    return this.prisma.utilityBill.update({
      where: { id },
      data: {
        status: "PAID",
        paidDate: new Date()
      }
    });
  }

  async overdue(tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    const now = new Date();

    await this.prisma.utilityBill.updateMany({
      where: {
        status: "UNPAID",
        dueDate: {
          lt: now
        },
        tenantId: scopedTenantId
      },
      data: {
        status: "OVERDUE"
      }
    });

    return this.prisma.utilityBill.findMany({
      where: {
        status: "OVERDUE",
        tenantId: scopedTenantId
      },
      include: {
        meter: true
      },
      orderBy: { dueDate: "asc" }
    });
  }

  async analytics(tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    const bills = await this.prisma.utilityBill.findMany({
      where: { tenantId: scopedTenantId },
      include: { meter: true },
      orderBy: { billingPeriodStart: "asc" }
    });

    const byType = new Map<string, { consumption: number; cost: number }>();
    for (const bill of bills) {
      const key = bill.meter.type;
      const current = byType.get(key) ?? { consumption: 0, cost: 0 };
      current.consumption += Number(bill.totalConsumption);
      current.cost += Number(bill.totalAmount);
      byType.set(key, current);
    }

    return {
      summaryByUtilityType: Array.from(byType.entries()).map(([type, totals]) => ({
        type,
        totalConsumption: totals.consumption,
        totalCost: totals.cost
      })),
      monthly: bills.map((bill) => ({
        month: bill.billingPeriodStart.toISOString().slice(0, 7),
        meterType: bill.meter.type,
        consumption: Number(bill.totalConsumption),
        totalAmount: Number(bill.totalAmount),
        location: bill.meter.location
      }))
    };
  }
}
