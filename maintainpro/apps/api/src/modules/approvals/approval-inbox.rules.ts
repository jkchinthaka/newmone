import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { ApprovalProcessType, VendorApprovalLevel } from "@prisma/client";

import {
  resolveVendorApprovalLevel,
  roleCanApproveVendorLevel,
  roleCanFinanceApprove
} from "../../common/utils/vendor-repair-governance";

export const INBOX_TABS = [
  "all",
  "requests",
  "work_orders",
  "parts",
  "vendor_quotations",
  "vendor_invoices",
  "emergency"
] as const;

export type InboxTab = (typeof INBOX_TABS)[number];

export type InboxKind =
  | "approval"
  | "work_order"
  | "request"
  | "part"
  | "vendor_quotation"
  | "vendor_invoice"
  | "emergency";

const WORK_ORDER_PROCESS_TYPES = new Set<string>([
  ApprovalProcessType.CRITICAL_WORK_ORDER,
  ApprovalProcessType.HIGH_COST_WORK_ORDER,
  ApprovalProcessType.VENDOR_REPAIR,
  ApprovalProcessType.WORK_ORDER_REOPEN,
  ApprovalProcessType.CLOSED_RECORD_CORRECTION
]);

export function inboxTab(input: { kind: InboxKind; processType?: string | null; status?: string | null }): Exclude<InboxTab, "all"> {
  if (input.kind === "emergency" || input.status === "EMERGENCY_OVERRIDE_PENDING_REVIEW") return "emergency";
  if (input.kind === "part") return "parts";
  if (input.kind === "vendor_quotation") return "vendor_quotations";
  if (input.kind === "vendor_invoice") return "vendor_invoices";
  if (input.kind === "request") return "requests";
  if (input.kind === "work_order") return "work_orders";
  if (input.processType && WORK_ORDER_PROCESS_TYPES.has(input.processType)) return "work_orders";
  return "requests";
}

export function assertNotOwnRequest(requesterId: string | null | undefined, actorId: string) {
  if (requesterId && requesterId === actorId) {
    throw new ForbiddenException("You cannot approve your own request");
  }
}

export function assertAmountWithinRole(role: string | undefined, amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) return;
  const level = resolveVendorApprovalLevel(amount);
  const allowed =
    level === VendorApprovalLevel.FINANCE ? roleCanFinanceApprove(role) : roleCanApproveVendorLevel(role, level);
  if (!allowed) {
    throw new ForbiddenException("Amount is above your approval limit");
  }
}

export function assertKindPermission(
  actor: { permissions?: string[] },
  kind: InboxKind,
  partStage?: "OPERATIONAL" | "FINANCE"
) {
  const perms = actor.permissions ?? [];
  if (perms.length === 0 || perms.includes("approvals.decide")) return;
  // Job approval is the PATCH /work-orders/:id/approve permission.
  if (kind === "work_order" && perms.includes("work_orders.manage")) return;
  const needed =
    kind === "part"
      ? partStage === "FINANCE"
        ? "part_requests.approve_finance"
        : "part_requests.approve_operational"
      : "approvals.decide";
  if (!perms.includes(needed)) {
    throw new ForbiddenException("You do not have permission for this approval type");
  }
}

export function assertExpectedVersion(actual: number | null | undefined, expected: number | null | undefined) {
  if (expected == null || actual == null || Number(actual) !== Number(expected)) {
    throw new ConflictException("This approval changed. Refresh and try again.");
  }
}

export function versionFromDate(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function slaTone(requestedAt: Date, dueAt: Date | null, now = Date.now()): "green" | "amber" | "red" {
  if (dueAt && dueAt.getTime() <= now) return "red";
  const age = now - requestedAt.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (dueAt) {
    const window = dueAt.getTime() - requestedAt.getTime();
    const remaining = dueAt.getTime() - now;
    if (window > 0 && remaining < window * 0.25) return "amber";
    return "green";
  }
  if (age > 2 * day) return "red";
  if (age > day) return "amber";
  return "green";
}

export function ageLabel(requestedAt: Date, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - requestedAt.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function readAmount(source: unknown): number | null {
  const record = asRecord(source);
  if (!record) return null;
  for (const key of ["amount", "totalAmount", "estimatedCost", "actualCost"]) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function asRecord(source: unknown): Record<string, unknown> | null {
  if (!source) return null;
  if (typeof source === "string") {
    try {
      const parsed = JSON.parse(source) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof source === "object" ? (source as Record<string, unknown>) : null;
}

export function assertSameBulkKind(kinds: string[]) {
  if (kinds.length === 0) {
    throw new BadRequestException("Select at least one row");
  }
  if (new Set(kinds).size !== 1) {
    throw new BadRequestException("Bulk approve is limited to one type");
  }
}

type StoredDecision = { fingerprint: string; result: unknown };

const completed = new Map<string, StoredDecision>();
const inflight = new Map<string, Promise<unknown>>();

export function resetApprovalIdempotency() {
  completed.clear();
  inflight.clear();
}

export async function withApprovalIdempotency<T>(
  key: string | undefined,
  fingerprint: string,
  run: () => Promise<T>
): Promise<T> {
  const trimmed = key?.trim();
  if (!trimmed) return run();
  const existing = completed.get(trimmed);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new ConflictException("Idempotency key was already used with a different payload");
    }
    return existing.result as T;
  }
  const pending = inflight.get(trimmed);
  if (pending) return pending as Promise<T>;
  const promise = run()
    .then((result) => {
      completed.set(trimmed, { fingerprint, result });
      inflight.delete(trimmed);
      return result;
    })
    .catch((error: unknown) => {
      inflight.delete(trimmed);
      throw error;
    });
  inflight.set(trimmed, promise);
  return promise;
}
