import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class UtilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  meters() {
    return this.prisma.utilityMeter.findMany({ orderBy: { createdAt: "desc" } });
  }

  async meter(id: string) {
    const meter = await this.prisma.utilityMeter.findUnique({ where: { id } });

    if (!meter) {
      throw new NotFoundException("Meter not found");
    }

    return meter;
  }

  createMeter(data: { meterNumber: string; type: "ELECTRICITY" | "WATER" | "GAS"; location: string; description?: string; unit: string }) {
    return this.prisma.utilityMeter.create({ data });
  }

  updateMeter(id: string, data: Partial<{ location: string; description: string; unit: string; isActive: boolean }>) {
    return this.prisma.utilityMeter.update({ where: { id }, data });
  }

  async addReading(id: string, data: { readingDate: string; readingValue: number; images?: string[]; notes?: string }) {
    await this.meter(id);

    const last = await this.prisma.meterReading.findFirst({
      where: { meterId: id },
      orderBy: { readingDate: "desc" }
    });

    if (last && Number(data.readingValue) < Number(last.readingValue)) {
      throw new BadRequestException("Meter readings must be monotonically increasing");
    }

    const consumption = last ? Number(data.readingValue) - Number(last.readingValue) : 0;

    return this.prisma.meterReading.create({
      data: {
        meterId: id,
        readingDate: new Date(data.readingDate),
        readingValue: data.readingValue,
        consumption,
        images: data.images ?? [],
        notes: data.notes
      }
    });
  }

  readings(id: string) {
    return this.prisma.meterReading.findMany({ where: { meterId: id }, orderBy: { readingDate: "desc" } });
  }

  allReadings() {
    return this.prisma.meterReading.findMany({ include: { meter: true }, orderBy: { readingDate: "desc" } });
  }

  async consumptionChart(id: string) {
    const readings = await this.prisma.meterReading.findMany({
      where: { meterId: id },
      orderBy: { readingDate: "asc" }
    });

    return readings.map((item) => ({
      month: item.readingDate.toISOString().slice(0, 7),
      consumption: Number(item.consumption ?? 0)
    }));
  }

  bills() {
    return this.prisma.utilityBill.findMany({ include: { meter: true }, orderBy: { createdAt: "desc" } });
  }

  async createBill(data: {
    meterId: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    totalConsumption: number;
    ratePerUnit: number;
    baseCharge?: number;
    taxAmount?: number;
    dueDate?: string;
    notes?: string;
  }) {
    const totalAmount = data.totalConsumption * data.ratePerUnit + (data.baseCharge ?? 0) + (data.taxAmount ?? 0);

    return this.prisma.utilityBill.create({
      data: {
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

  async bill(id: string) {
    const bill = await this.prisma.utilityBill.findUnique({ where: { id }, include: { meter: true } });

    if (!bill) {
      throw new NotFoundException("Bill not found");
    }

    return bill;
  }

  payBill(id: string) {
    return this.prisma.utilityBill.update({
      where: { id },
      data: {
        status: "PAID",
        paidDate: new Date()
      }
    });
  }

  async overdue() {
    const now = new Date();

    await this.prisma.utilityBill.updateMany({
      where: {
        status: "UNPAID",
        dueDate: {
          lt: now
        }
      },
      data: {
        status: "OVERDUE"
      }
    });

    return this.prisma.utilityBill.findMany({
      where: {
        status: "OVERDUE"
      },
      include: {
        meter: true
      },
      orderBy: { dueDate: "asc" }
    });
  }

  async analytics() {
    const bills = await this.prisma.utilityBill.findMany({ include: { meter: true }, orderBy: { billingPeriodStart: "asc" } });

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
