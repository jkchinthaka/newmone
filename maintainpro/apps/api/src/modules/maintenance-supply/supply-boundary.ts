/**
 * Source-of-truth boundary between Bileeta ERP and MaintainPro.
 * Bileeta owns official item master, warehouse stock, PO/GRN, and financial accounting.
 * MaintainPro owns maintenance usage context only.
 */

export type StockSource = "BILEETA_ERP" | "MAINTAINPRO_REFERENCE" | "UNKNOWN";

export type StockBoundaryResult = {
  authoritative: boolean;
  source: StockSource;
  mayReserve: boolean;
  mayPurchase: boolean;
  message: string;
};

export function resolveStockSourceBoundary(input: {
  erpCode?: string | null;
  erpSyncEnabled?: boolean;
  productionMode?: boolean;
  mockSync?: boolean;
}): StockBoundaryResult {
  if (input.productionMode && input.mockSync) {
    return {
      authoritative: false,
      source: "UNKNOWN",
      mayReserve: true,
      mayPurchase: false,
      message: "Mock sync must never be reported as production ERP success"
    };
  }
  if (input.erpCode && input.erpSyncEnabled) {
    return {
      authoritative: false,
      source: "BILEETA_ERP",
      mayReserve: true,
      mayPurchase: false,
      message: "Official stock is Bileeta; MaintainPro may reserve/consume for WO context only"
    };
  }
  return {
    authoritative: false,
    source: "MAINTAINPRO_REFERENCE",
    mayReserve: true,
    mayPurchase: false,
    message: "Reference stock only — not official warehouse truth"
  };
}

export type WoCostBreakdown = {
  partsCost: number;
  internalLabourCost: number;
  externalServiceCost: number;
  transportCost: number;
  otherCost: number;
};

export function computeWorkOrderTotalCost(b: WoCostBreakdown): number {
  return (
    Number(b.partsCost || 0) +
    Number(b.internalLabourCost || 0) +
    Number(b.externalServiceCost || 0) +
    Number(b.transportCost || 0) +
    Number(b.otherCost || 0)
  );
}

export function contractExpiryStatus(input: {
  endDate: Date;
  now?: Date;
  reminderDays?: number;
}): "ACTIVE" | "EXPIRING" | "EXPIRED" {
  const now = input.now ?? new Date();
  const reminder = input.reminderDays ?? 30;
  if (now.getTime() > input.endDate.getTime()) return "EXPIRED";
  const daysLeft = (input.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  if (daysLeft <= reminder) return "EXPIRING";
  return "ACTIVE";
}

export function erpSyncOutcome(input: {
  productionMode: boolean;
  mockMode: boolean;
  success: boolean;
  error?: string | null;
}): { ok: boolean; reportableAsProductionSuccess: boolean; status: string; error?: string } {
  if (input.mockMode) {
    return {
      ok: input.success,
      reportableAsProductionSuccess: false,
      status: input.success ? "MOCK_OK" : "MOCK_FAILED",
      error: input.error ?? undefined
    };
  }
  if (!input.success) {
    return {
      ok: false,
      reportableAsProductionSuccess: false,
      status: "FAILED",
      error: input.error ?? "ERP_SYNC_FAILED"
    };
  }
  return {
    ok: true,
    reportableAsProductionSuccess: input.productionMode,
    status: "SUCCESS"
  };
}
