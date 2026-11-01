import { p4Delete, p4Get, p4Patch, p4Post } from "@/lib/phase4-api";

export type CertificateState = "VALID" | "DUE_SOON" | "EXPIRED";

export interface CertificateType {
  key: string;
  label: string;
  defaultIntervalMonths: number;
  defaultReminderDays: number;
}

export interface CertificateRow {
  id: string;
  assetId: string;
  assetTag: string | null;
  assetName: string | null;
  typeKey: string;
  typeLabel: string;
  title: string;
  issuedAt: string | null;
  expiresAt: string | null;
  providerName: string | null;
  certificateUrl: string | null;
  state: CertificateState;
  daysLeft: number;
}

export interface CertificateSummary {
  total: number;
  valid: number;
  dueSoon: number;
  expired: number;
}

export const CERTIFICATE_STATE_LABEL: Record<CertificateState, string> = {
  VALID: "Valid",
  DUE_SOON: "Due soon",
  EXPIRED: "Expired"
};

export const CERTIFICATE_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR"];

/** Adds whole months to a yyyy-mm-dd date; returns "" for anything that is not a date. */
export function addMonthsYmd(ymd: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match || !Number.isFinite(months)) return "";
  const [, y, m, d] = match;
  const target = new Date(Date.UTC(Number(y), Number(m) - 1 + months, Number(d)));
  return Number.isNaN(target.getTime()) ? "" : target.toISOString().slice(0, 10);
}

/** A certificate runs to the end of its expiry day in Sri Lanka. */
export function expiryIso(ymd: string): string {
  return new Date(`${ymd}T23:59:00+05:30`).toISOString();
}

export function daysLeftText(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "day" : "days"} overdue`;
  if (daysLeft === 0) return "Expires today";
  return `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;
}

export const listCertificates = (state?: CertificateState) =>
  p4Get<CertificateRow[]>("/compliance/certificates", state ? { state } : undefined);
export const getCertificateSummary = () => p4Get<CertificateSummary>("/compliance/certificates/summary");
export const listCertificateTypes = () => p4Get<CertificateType[]>("/compliance/certificates/types");
export const createCertificate = (body: {
  assetId: string;
  typeKey: string;
  issuedAt?: string;
  expiresAt: string;
  providerName?: string;
}) => p4Post<unknown>("/compliance/certificates", body);
export const renewCertificate = (id: string, body: { issuedAt?: string; expiresAt: string }) =>
  p4Patch<unknown>(`/compliance/certificates/${id}/renew`, body);
export const removeCertificate = (id: string) => p4Delete<unknown>(`/compliance/certificates/${id}`);
