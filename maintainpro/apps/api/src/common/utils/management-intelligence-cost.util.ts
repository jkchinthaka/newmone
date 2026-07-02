import type { VendorInvoiceStatus } from "@prisma/client";
import { VendorInvoiceStatus as VendorInvoiceStatusEnum } from "@prisma/client";

import { resolveRiskSeverity } from "./maintenance-risk-score";

export const REPAIR_REPLACE_COST_90D = Number(process.env.REPAIR_REPLACE_COST_90D ?? 50_000);
export const REPAIR_REPLACE_BREAKDOWNS = Number(process.env.REPAIR_REPLACE_BREAKDOWNS ?? 3);
export const REPAIR_REPLACE_DOWNTIME_HOURS = Number(process.env.REPAIR_REPLACE_DOWNTIME_HOURS ?? 48);
export const DOWNTIME_HOURLY_COST = Number(process.env.DOWNTIME_HOURLY_COST ?? 0);

export const APPROVED_INVOICE_STATUSES = new Set<VendorInvoiceStatus>([
  VendorInvoiceStatusEnum.APPROVED,
  VendorInvoiceStatusEnum.PAID
]);

export type CostComponents = {
  partsCost: number;
  vendorCost: number;
  laborCost: number;
  totalMaintenanceCost: number;
};

export function hoursBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
}

export function computeDowntimeHours(startDate?: Date | null, completedDate?: Date | null): number {
  if (!startDate || !completedDate) {
    return 0;
  }
  return Number(hoursBetween(startDate, completedDate).toFixed(2));
}

export function computeWorkOrderCosts(input: {
  parts: Array<{ usedQuantity: number; unitCost: number }>;
  invoices: Array<{ totalAmount: number; status: VendorInvoiceStatus }>;
  actualCost?: number | null;
}): CostComponents {
  const partsCost = input.parts.reduce((sum, line) => sum + line.usedQuantity * line.unitCost, 0);
  const vendorCost = input.invoices
    .filter((invoice) => APPROVED_INVOICE_STATUSES.has(invoice.status))
    .reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const laborCost = input.actualCost ?? 0;
  return {
    partsCost: Number(partsCost.toFixed(2)),
    vendorCost: Number(vendorCost.toFixed(2)),
    laborCost: Number(laborCost.toFixed(2)),
    totalMaintenanceCost: Number((partsCost + vendorCost + laborCost).toFixed(2))
  };
}

export type RecommendedAction =
  | "Monitor"
  | "Preventive maintenance required"
  | "Vendor review required"
  | "Replacement review required"
  | "Major overhaul review required"
  | "Management review required";

export function recommendAction(input: {
  totalCost: number;
  repeatedCount: number;
  downtimeHours: number;
  vendorCost: number;
  partsCost: number;
  highRiskCount?: number;
}): RecommendedAction {
  if (input.repeatedCount >= 5 || input.totalCost >= REPAIR_REPLACE_COST_90D * 2) {
    return "Replacement review required";
  }
  if (input.repeatedCount >= REPAIR_REPLACE_BREAKDOWNS || input.downtimeHours >= REPAIR_REPLACE_DOWNTIME_HOURS * 2) {
    return "Major overhaul review required";
  }
  if (input.totalCost >= REPAIR_REPLACE_COST_90D || (input.highRiskCount ?? 0) >= 2) {
    return "Management review required";
  }
  if (input.vendorCost > input.partsCost && input.vendorCost > 0) {
    return "Vendor review required";
  }
  if (input.repeatedCount >= 2) {
    return "Preventive maintenance required";
  }
  return "Monitor";
}

export function repairVsReplaceFlag(input: {
  cost90Days: number;
  repeatedCount: number;
  downtimeHours: number;
  assetValue?: number | null;
  partsCost90Days?: number;
}): boolean {
  if (input.cost90Days >= REPAIR_REPLACE_COST_90D) return true;
  if (input.repeatedCount >= REPAIR_REPLACE_BREAKDOWNS) return true;
  if (input.downtimeHours >= REPAIR_REPLACE_DOWNTIME_HOURS) return true;
  if (input.assetValue && input.partsCost90Days && input.partsCost90Days >= input.assetValue * 0.5) return true;
  return false;
}

export function riskSeverityFromCost(totalCost: number, repeatedCount: number): ReturnType<typeof resolveRiskSeverity> {
  const score = (totalCost >= REPAIR_REPLACE_COST_90D ? 40 : 0) + repeatedCount * 10 + (totalCost >= 25_000 ? 15 : 0);
  return resolveRiskSeverity(score);
}

export const MANAGEMENT_INTELLIGENCE_DISCLAIMER =
  "Rule-based maintenance profitability and cost intelligence — not AI prediction. Totals combine parts usage, approved vendor invoices, and recorded labor/actual cost.";
