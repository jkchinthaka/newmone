import type {
  AnalyticsFilters,
  BillStatus,
  MeterReading,
  TrendInfo,
  UtilityAnalytics,
  UtilityBill,
  UtilityMeter,
  UtilityType,
  UtilityTypeFilter
} from "./types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric"
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit"
});

export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatQuantity(value: number): string {
  return numberFormatter.format(value);
}

export function formatCompact(value: number): string {
  return compactNumberFormatter.format(value);
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return dateFormatter.format(parsed);
}

export function formatMonth(value: string): string {
  const normalized = value.length === 7 ? `${value}-01T00:00:00.000Z` : value;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return monthFormatter.format(parsed);
}

export function toMonthKey(value?: string | null): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 7);
}

export function getErrorMessage(error: unknown): string {
  const fallback = "Something went wrong. Please try again.";

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const maybeError = error as {
    message?: string;
    response?: {
      data?: {
        message?: string | string[];
      };
    };
  };

  const responseMessage = maybeError.response?.data?.message;

  if (Array.isArray(responseMessage) && responseMessage.length > 0) {
    return responseMessage.join(", ");
  }

  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  if (typeof maybeError.message === "string" && maybeError.message.trim()) {
    return maybeError.message;
  }

  return fallback;
}

export function utilityTypeLabel(type: UtilityType): string {
  switch (type) {
    case "ELECTRICITY":
      return "Electricity";
    case "WATER":
      return "Water";
    case "GAS":
      return "Gas";
    default:
      return type;
  }
}

export function utilityTypeTone(type: UtilityType): string {
  switch (type) {
    case "ELECTRICITY":
      return "bg-sky-100 text-sky-700 ring-sky-200";
    case "WATER":
      return "bg-cyan-100 text-cyan-700 ring-cyan-200";
    case "GAS":
      return "bg-violet-100 text-violet-700 ring-violet-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function getComputedBillStatus(bill: UtilityBill, now = new Date()): BillStatus {
  if (bill.status === "PAID") {
    return "PAID";
  }

  if (bill.status === "OVERDUE") {
    return "OVERDUE";
  }

  if (!bill.dueDate) {
    return bill.status;
  }

  const dueDate = new Date(bill.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return bill.status;
  }

  if (dueDate.getTime() < now.getTime()) {
    return "OVERDUE";
  }

  return bill.status;
}

export function billStatusTone(status: BillStatus): string {
  switch (status) {
    case "PAID":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "UNPAID":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "OVERDUE":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "DISPUTED":
      return "bg-violet-100 text-violet-700 ring-violet-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function getTrend(current: number, previous: number): TrendInfo {
  if (previous <= 0) {
    return {
      value: current,
      previous,
      direction: "flat",
      deltaPercent: 0
    };
  }

  const delta = ((current - previous) / previous) * 100;

  if (Math.abs(delta) < 0.25) {
    return {
      value: current,
      previous,
      direction: "flat",
      deltaPercent: 0
    };
  }

  return {
    value: current,
    previous,
    direction: delta > 0 ? "up" : "down",
    deltaPercent: Math.abs(delta)
  };
}

function isWithinRange(monthKey: string, filters: AnalyticsFilters): boolean {
  if (!monthKey) {
    return false;
  }

  const lower = filters.startDate ? filters.startDate.slice(0, 7) : "";
  const upper = filters.endDate ? filters.endDate.slice(0, 7) : "";

  if (lower && monthKey < lower) {
    return false;
  }

  if (upper && monthKey > upper) {
    return false;
  }

  return true;
}

function utilityTypeAllowed(type: UtilityType, utilityType: UtilityTypeFilter): boolean {
  if (utilityType === "ALL") {
    return true;
  }

  return type === utilityType;
}

export function buildConsumptionTrendSeries(analytics: UtilityAnalytics, filters?: AnalyticsFilters) {
  const monthlyMap = new Map<string, { month: string; ELECTRICITY: number; WATER: number; GAS: number }>();

  analytics.monthly.forEach((point) => {
    if (filters && !isWithinRange(point.month, filters)) {
      return;
    }

    if (filters && !utilityTypeAllowed(point.meterType, filters.utilityType)) {
      return;
    }

    const current = monthlyMap.get(point.month) ?? {
      month: point.month,
      ELECTRICITY: 0,
      WATER: 0,
      GAS: 0
    };

    current[point.meterType] += toNumber(point.consumption);
    monthlyMap.set(point.month, current);
  });

  return [...monthlyMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      ...item,
      label: formatMonth(item.month)
    }));
}

export function buildCostByTypeSeries(analytics: UtilityAnalytics, filters?: AnalyticsFilters) {
  if (!filters) {
    return analytics.summaryByUtilityType.map((entry) => ({
      type: entry.type,
      label: utilityTypeLabel(entry.type),
      totalCost: toNumber(entry.totalCost),
      totalConsumption: toNumber(entry.totalConsumption)
    }));
  }

  const sums = new Map<UtilityType, { type: UtilityType; totalCost: number; totalConsumption: number }>();

  analytics.monthly.forEach((point) => {
    if (!isWithinRange(point.month, filters)) {
      return;
    }

    if (!utilityTypeAllowed(point.meterType, filters.utilityType)) {
      return;
    }

    const current = sums.get(point.meterType) ?? {
      type: point.meterType,
      totalCost: 0,
      totalConsumption: 0
    };

    current.totalCost += toNumber(point.totalAmount);
    current.totalConsumption += toNumber(point.consumption);
    sums.set(point.meterType, current);
  });

  return [...sums.values()].map((entry) => ({
    ...entry,
    label: utilityTypeLabel(entry.type)
  }));
}

export function buildTopMeterSeries(bills: UtilityBill[], meters: UtilityMeter[], filters: AnalyticsFilters) {
  const meterById = new Map(meters.map((meter) => [meter.id, meter]));
  const sums = new Map<string, { meterId: string; meterNumber: string; location: string; consumption: number; cost: number }>();

  bills.forEach((bill) => {
    const meter = bill.meter ?? meterById.get(bill.meterId);

    if (!meter) {
      return;
    }

    const monthKey = toMonthKey(bill.billingPeriodStart);
    if (!isWithinRange(monthKey, filters)) {
      return;
    }

    if (!utilityTypeAllowed(meter.type, filters.utilityType)) {
      return;
    }

    const current = sums.get(meter.id) ?? {
      meterId: meter.id,
      meterNumber: meter.meterNumber,
      location: meter.location,
      consumption: 0,
      cost: 0
    };

    current.consumption += toNumber(bill.totalConsumption);
    current.cost += toNumber(bill.totalAmount);
    sums.set(meter.id, current);
  });

  return [...sums.values()]
    .sort((a, b) => b.consumption - a.consumption)
    .slice(0, 5);
}

export function buildCurrentMonthConsumption(bills: UtilityBill[], now = new Date()): number {
  const currentMonth = now.toISOString().slice(0, 7);

  return bills.reduce((sum, bill) => {
    if (toMonthKey(bill.billingPeriodStart) !== currentMonth) {
      return sum;
    }

    return sum + toNumber(bill.totalConsumption);
  }, 0);
}

export function buildPreviousMonthConsumption(bills: UtilityBill[], now = new Date()): number {
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousMonth = previous.toISOString().slice(0, 7);

  return bills.reduce((sum, bill) => {
    if (toMonthKey(bill.billingPeriodStart) !== previousMonth) {
      return sum;
    }

    return sum + toNumber(bill.totalConsumption);
  }, 0);
}

export type ConsumptionSpikeAlert = {
  meterId: string;
  meterNumber: string;
  date: string;
  consumption: number;
  previousConsumption: number;
};

export function detectConsumptionSpikes(readings: MeterReading[], meters: UtilityMeter[]): ConsumptionSpikeAlert[] {
  const byMeter = new Map<string, MeterReading[]>();
  const meterById = new Map(meters.map((meter) => [meter.id, meter]));

  readings.forEach((reading) => {
    const list = byMeter.get(reading.meterId) ?? [];
    list.push(reading);
    byMeter.set(reading.meterId, list);
  });

  const spikes: ConsumptionSpikeAlert[] = [];

  byMeter.forEach((meterReadings, meterId) => {
    const sorted = [...meterReadings].sort((a, b) => a.readingDate.localeCompare(b.readingDate));

    for (let index = 1; index < sorted.length; index += 1) {
      const current = toNumber(sorted[index].consumption);
      const previous = toNumber(sorted[index - 1].consumption);

      if (previous <= 0) {
        continue;
      }

      if (current >= previous * 2) {
        spikes.push({
          meterId,
          meterNumber: meterById.get(meterId)?.meterNumber ?? "Unknown meter",
          date: sorted[index].readingDate,
          consumption: current,
          previousConsumption: previous
        });
      }
    }
  });

  return spikes
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
}
