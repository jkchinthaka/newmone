import { apiClient } from "@/lib/api-client";

export type ApiEnvelope<T> = { data: T; message?: string };

export async function farmGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return res.data.data;
}

export async function farmPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiClient.post<ApiEnvelope<T>>(path, body);
  return res.data.data;
}

export async function farmPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiClient.patch<ApiEnvelope<T>>(path, body);
  return res.data.data;
}

export async function farmDelete<T>(path: string): Promise<T> {
  const res = await apiClient.delete<ApiEnvelope<T>>(path);
  return res.data.data;
}

export function formatLkr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "2-digit" });
}
