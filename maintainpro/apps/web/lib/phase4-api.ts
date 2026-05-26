import { apiClient } from "@/lib/api-client";

export type ApiEnvelope<T> = { data: T; message?: string; success?: boolean };

export async function p4Get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return res.data.data;
}

export async function p4Post<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiClient.post<ApiEnvelope<T>>(path, body);
  return res.data.data;
}

export async function p4Patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiClient.patch<ApiEnvelope<T>>(path, body);
  return res.data.data;
}

export async function p4Delete<T>(path: string): Promise<T> {
  const res = await apiClient.delete<ApiEnvelope<T>>(path);
  return res.data.data;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0
  }).format(n);
}

export type ComplianceStatus = "COMPLIANT" | "ATTENTION_REQUIRED" | "NON_COMPLIANT";

export const COMPLIANCE_BADGE: Record<ComplianceStatus, string> = {
  COMPLIANT: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ATTENTION_REQUIRED: "bg-amber-100 text-amber-700 border-amber-200",
  NON_COMPLIANT: "bg-rose-100 text-rose-700 border-rose-200"
};

export const VEHICLE_DOCUMENT_TYPES = [
  "REGISTRATION",
  "INSURANCE",
  "PERMIT",
  "FITNESS",
  "POLLUTION",
  "ROAD_TAX",
  "OTHER"
] as const;
export type VehicleDocumentType = (typeof VEHICLE_DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUS_BADGE: Record<string, string> = {
  PENDING_VERIFICATION: "bg-slate-100 text-slate-700 border-slate-200",
  VERIFIED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-700 border-rose-200",
  EXPIRED: "bg-amber-100 text-amber-700 border-amber-200"
};

export const ACCIDENT_SEVERITY = ["MINOR", "MODERATE", "MAJOR", "CRITICAL"] as const;
export const ACCIDENT_STATUS = ["REPORTED", "UNDER_INVESTIGATION", "REPAIRING", "CLOSED"] as const;
export const ACCIDENT_EVIDENCE_TYPES = ["PHOTO", "VIDEO", "POLICE_REPORT", "WITNESS_STATEMENT", "OTHER"] as const;

export const CLAIM_STATUS = [
  "DRAFT",
  "FILED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "SETTLED",
  "CLOSED"
] as const;

export const FINE_RESPONSIBILITY = ["DRIVER", "ORGANIZATION", "VEHICLE_DEFECT", "UNDETERMINED"] as const;
export const FINE_PAYMENT_STATUS = ["PENDING", "PAID", "DISPUTED", "OVERDUE", "WAIVED"] as const;
export type FineResponsibility = (typeof FINE_RESPONSIBILITY)[number];
export type FinePaymentStatus = (typeof FINE_PAYMENT_STATUS)[number];
