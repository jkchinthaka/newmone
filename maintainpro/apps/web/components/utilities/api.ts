import { apiClient } from "@/lib/api-client";

import { toNumber } from "./helpers";
import type {
  ApiEnvelope,
  BillFormValues,
  MeterFormValues,
  MeterReading,
  ReadingFormValues,
  UtilityAnalytics,
  UtilityAnalyticsMonthlyPoint,
  UtilityAnalyticsSummary,
  UtilityBill,
  UtilityMeter,
  UtilityType
} from "./types";

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}

function normalizeUtilityType(value: unknown): UtilityType {
  if (value === "ELECTRICITY" || value === "WATER" || value === "GAS") {
    return value;
  }

  return "ELECTRICITY";
}

function sanitizeMeter(raw: unknown): UtilityMeter {
  const row = (raw ?? {}) as Record<string, unknown>;

  return {
    id: String(row.id ?? ""),
    meterNumber: String(row.meterNumber ?? ""),
    type: normalizeUtilityType(row.type),
    location: String(row.location ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    unit: String(row.unit ?? ""),
    isActive: Boolean(row.isActive),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString()
  };
}

function sanitizeReading(raw: unknown): MeterReading {
  const row = (raw ?? {}) as Record<string, unknown>;
  const meterRaw = row.meter && typeof row.meter === "object" ? sanitizeMeter(row.meter) : undefined;

  return {
    id: String(row.id ?? ""),
    meterId: String(row.meterId ?? meterRaw?.id ?? ""),
    readingDate: typeof row.readingDate === "string" ? row.readingDate : new Date().toISOString(),
    readingValue: toNumber(row.readingValue),
    consumption: row.consumption == null ? null : toNumber(row.consumption),
    images: Array.isArray(row.images) ? row.images.filter((item): item is string => typeof item === "string") : [],
    notes: typeof row.notes === "string" ? row.notes : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    meter: meterRaw
  };
}

function sanitizeBill(raw: unknown): UtilityBill {
  const row = (raw ?? {}) as Record<string, unknown>;
  const meterRaw = row.meter && typeof row.meter === "object" ? sanitizeMeter(row.meter) : undefined;

  const status = row.status;
  const normalizedStatus =
    status === "PAID" || status === "UNPAID" || status === "OVERDUE" || status === "DISPUTED" ? status : "UNPAID";

  return {
    id: String(row.id ?? ""),
    meterId: String(row.meterId ?? meterRaw?.id ?? ""),
    billingPeriodStart: typeof row.billingPeriodStart === "string" ? row.billingPeriodStart : new Date().toISOString(),
    billingPeriodEnd: typeof row.billingPeriodEnd === "string" ? row.billingPeriodEnd : new Date().toISOString(),
    totalConsumption: toNumber(row.totalConsumption),
    ratePerUnit: toNumber(row.ratePerUnit),
    baseCharge: row.baseCharge == null ? null : toNumber(row.baseCharge),
    taxAmount: row.taxAmount == null ? null : toNumber(row.taxAmount),
    totalAmount: toNumber(row.totalAmount),
    dueDate: typeof row.dueDate === "string" ? row.dueDate : null,
    paidDate: typeof row.paidDate === "string" ? row.paidDate : null,
    status: normalizedStatus,
    invoiceUrl: typeof row.invoiceUrl === "string" ? row.invoiceUrl : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
    meter: meterRaw
  };
}

function sanitizeAnalyticsSummary(raw: unknown): UtilityAnalyticsSummary {
  const row = (raw ?? {}) as Record<string, unknown>;

  return {
    type: normalizeUtilityType(row.type),
    totalConsumption: toNumber(row.totalConsumption),
    totalCost: toNumber(row.totalCost)
  };
}

function sanitizeAnalyticsMonthly(raw: unknown): UtilityAnalyticsMonthlyPoint {
  const row = (raw ?? {}) as Record<string, unknown>;

  return {
    month: typeof row.month === "string" ? row.month : "",
    meterType: normalizeUtilityType(row.meterType),
    consumption: toNumber(row.consumption),
    totalAmount: toNumber(row.totalAmount),
    location: typeof row.location === "string" ? row.location : ""
  };
}

function sanitizeAnalytics(raw: unknown): UtilityAnalytics {
  const row = (raw ?? {}) as Record<string, unknown>;

  return {
    summaryByUtilityType: Array.isArray(row.summaryByUtilityType)
      ? row.summaryByUtilityType.map((entry) => sanitizeAnalyticsSummary(entry))
      : [],
    monthly: Array.isArray(row.monthly) ? row.monthly.map((entry) => sanitizeAnalyticsMonthly(entry)) : []
  };
}

function parseImageUrls(input?: string): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(/\r?\n|,/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

export async function fetchUtilityMeters(): Promise<UtilityMeter[]> {
  const response = await apiClient.get<ApiEnvelope<unknown[]>>("/utilities/meters");
  const rows = unwrapData<unknown[]>(response.data);

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => sanitizeMeter(row));
}

export async function createUtilityMeter(payload: MeterFormValues): Promise<UtilityMeter> {
  const response = await apiClient.post<ApiEnvelope<unknown>>("/utilities/meters", payload);
  return sanitizeMeter(unwrapData(response.data));
}

export async function updateUtilityMeter(
  id: string,
  payload: Partial<Pick<UtilityMeter, "location" | "description" | "unit" | "isActive">>
): Promise<UtilityMeter> {
  const response = await apiClient.patch<ApiEnvelope<unknown>>(`/utilities/meters/${id}`, payload);
  return sanitizeMeter(unwrapData(response.data));
}

export async function fetchUtilityReadings(): Promise<MeterReading[]> {
  try {
    const response = await apiClient.get<ApiEnvelope<unknown[]>>("/utilities/readings");
    const rows = unwrapData<unknown[]>(response.data);

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map((row) => sanitizeReading(row));
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;

    if (status !== 404) {
      throw error;
    }

    const meters = await fetchUtilityMeters();
    const readingRows = await Promise.all(
      meters.map(async (meter) => {
        const response = await apiClient.get<ApiEnvelope<unknown[]>>(`/utilities/meters/${meter.id}/readings`);
        const rows = unwrapData<unknown[]>(response.data);

        if (!Array.isArray(rows)) {
          return [] as MeterReading[];
        }

        return rows.map((row) => {
          const normalized = sanitizeReading(row);
          return {
            ...normalized,
            meterId: normalized.meterId || meter.id,
            meter
          };
        });
      })
    );

    return readingRows.flat();
  }
}

export async function createUtilityReading(payload: ReadingFormValues): Promise<MeterReading> {
  const requestPayload = {
    meterId: payload.meterId,
    readingDate: payload.readingDate,
    readingValue: payload.readingValue,
    notes: payload.notes,
    images: parseImageUrls(payload.images)
  };

  try {
    const response = await apiClient.post<ApiEnvelope<unknown>>("/utilities/readings", requestPayload);
    return sanitizeReading(unwrapData(response.data));
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;

    if (status !== 404) {
      throw error;
    }

    const response = await apiClient.post<ApiEnvelope<unknown>>(`/utilities/meters/${payload.meterId}/readings`, {
      readingDate: payload.readingDate,
      readingValue: payload.readingValue,
      notes: payload.notes,
      images: parseImageUrls(payload.images)
    });

    return sanitizeReading(unwrapData(response.data));
  }
}

export async function fetchUtilityBills(): Promise<UtilityBill[]> {
  const response = await apiClient.get<ApiEnvelope<unknown[]>>("/utilities/bills");
  const rows = unwrapData<unknown[]>(response.data);

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => sanitizeBill(row));
}

export async function createUtilityBill(payload: BillFormValues): Promise<UtilityBill> {
  const response = await apiClient.post<ApiEnvelope<unknown>>("/utilities/bills", {
    meterId: payload.meterId,
    billingPeriodStart: payload.billingPeriodStart,
    billingPeriodEnd: payload.billingPeriodEnd,
    totalConsumption: payload.totalConsumption,
    ratePerUnit: payload.ratePerUnit,
    baseCharge: payload.baseCharge,
    taxAmount: payload.taxAmount,
    dueDate: payload.dueDate,
    notes: payload.notes
  });

  return sanitizeBill(unwrapData(response.data));
}

export async function markUtilityBillPaid(id: string): Promise<UtilityBill> {
  try {
    const response = await apiClient.patch<ApiEnvelope<unknown>>(`/utilities/bills/${id}/pay`);
    return sanitizeBill(unwrapData(response.data));
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;

    if (status !== 404) {
      throw error;
    }

    const response = await apiClient.patch<ApiEnvelope<unknown>>("/utilities/bills/pay", { id });
    return sanitizeBill(unwrapData(response.data));
  }
}

export async function fetchUtilityAnalytics(): Promise<UtilityAnalytics> {
  const response = await apiClient.get<ApiEnvelope<unknown>>("/utilities/analytics");
  return sanitizeAnalytics(unwrapData(response.data));
}
