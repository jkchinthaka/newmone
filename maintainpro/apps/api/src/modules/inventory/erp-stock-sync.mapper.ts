import { StockBalanceSnapshot } from "./inventory-erp-adapter.service";

export const ERP_STOCK_SYNC_SAMPLE_LIMIT = 5;

export type ErpStockSyncStatus =
  | "blocked"
  | "not_configured"
  | "misconfigured"
  | "ready"
  | "completed";

export type ErpStockSyncComparisonRow = {
  partId: string;
  partNumber: string;
  partName: string;
  maintainProQuantity: number;
  erpQuantity: number;
  delta: number;
  warehouseCode: string | null;
};

export type ErpStockSyncUnmatchedRow = {
  itemCode: string;
  quantity: number | null;
  warehouseCode: string | null;
  reason: string;
};

export type ErpStockSyncSummaryCounts = {
  matchedItems: number;
  unmatchedErpItems: number;
  unmatchedMaintainProItems: number;
  changedItems: number;
  unchangedItems: number;
};

export type ErpStockSyncDryRunResult = {
  mode: string;
  status: ErpStockSyncStatus;
  checkedAt: string;
  summary: ErpStockSyncSummaryCounts;
  warnings: string[];
  sampleRows: ErpStockSyncComparisonRow[];
  changedRows: ErpStockSyncComparisonRow[];
  unmatchedErpSamples: ErpStockSyncUnmatchedRow[];
  unmatchedMaintainProSamples: ErpStockSyncUnmatchedRow[];
  applyEnabled: boolean;
  message: string;
};

export type ErpStockSyncApplyResult = {
  mode: string;
  status: ErpStockSyncStatus;
  appliedAt: string;
  updatedCount: number;
  skippedCount: number;
  warnings: string[];
  message: string;
};

export type ErpStockSyncReadiness = {
  adapterId: string;
  mode: string;
  state: "disabled" | "not_configured" | "misconfigured" | "configured";
  readOnlySyncEnabled: boolean;
  applyEnabled: boolean;
  stockEndpointPresent: boolean;
  baseUrlPresent: boolean;
  credentialPresent: boolean;
  message: string;
  missingKeys: string[];
};

export type MaintainProPartSnapshot = {
  id: string;
  partNumber: string;
  name: string;
  quantityInStock: number;
};

const PUBLIC_DRY_RUN_KEYS = new Set<string>([
  "mode",
  "status",
  "checkedAt",
  "summary",
  "warnings",
  "sampleRows",
  "changedRows",
  "unmatchedErpSamples",
  "unmatchedMaintainProSamples",
  "applyEnabled",
  "message"
]);

export function normalizeErpItemCode(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function compareStockBalances(input: {
  erpBalances: StockBalanceSnapshot[];
  maintainProParts: MaintainProPartSnapshot[];
}): {
  summary: ErpStockSyncSummaryCounts;
  matchedRows: ErpStockSyncComparisonRow[];
  changedRows: ErpStockSyncComparisonRow[];
  unmatchedErpItems: ErpStockSyncUnmatchedRow[];
  unmatchedMaintainProItems: ErpStockSyncUnmatchedRow[];
  warnings: string[];
} {
  const erpByCode = new Map<string, StockBalanceSnapshot>();
  for (const balance of input.erpBalances) {
    const code = normalizeErpItemCode(balance.partSku);
    if (!code) {
      continue;
    }
    erpByCode.set(code, balance);
  }

  const maintainProByCode = new Map<string, MaintainProPartSnapshot>();
  for (const part of input.maintainProParts) {
    maintainProByCode.set(normalizeErpItemCode(part.partNumber), part);
  }

  const matchedRows: ErpStockSyncComparisonRow[] = [];
  const changedRows: ErpStockSyncComparisonRow[] = [];
  const unmatchedMaintainProItems: ErpStockSyncUnmatchedRow[] = [];
  const warnings: string[] = [];

  for (const part of input.maintainProParts) {
    const code = normalizeErpItemCode(part.partNumber);
    const erpBalance = erpByCode.get(code);
    if (!erpBalance) {
      unmatchedMaintainProItems.push({
        itemCode: part.partNumber,
        quantity: part.quantityInStock,
        warehouseCode: null,
        reason: "No matching Bileeta item code for MaintainPro partNumber"
      });
      continue;
    }

    const row: ErpStockSyncComparisonRow = {
      partId: part.id,
      partNumber: part.partNumber,
      partName: part.name,
      maintainProQuantity: part.quantityInStock,
      erpQuantity: erpBalance.quantityOnHand,
      delta: erpBalance.quantityOnHand - part.quantityInStock,
      warehouseCode: erpBalance.warehouseCode ?? null
    };
    matchedRows.push(row);
    if (row.delta !== 0) {
      changedRows.push(row);
    }
  }

  const unmatchedErpItems: ErpStockSyncUnmatchedRow[] = [];
  for (const [code, balance] of erpByCode.entries()) {
    if (!maintainProByCode.has(code)) {
      unmatchedErpItems.push({
        itemCode: balance.partSku,
        quantity: balance.quantityOnHand,
        warehouseCode: balance.warehouseCode ?? null,
        reason: "No matching MaintainPro partNumber for ERP item code"
      });
    }
  }

  if (unmatchedErpItems.length > 0) {
    warnings.push(`${unmatchedErpItems.length} ERP item code(s) have no local part match.`);
  }
  if (unmatchedMaintainProItems.length > 0) {
    warnings.push(`${unmatchedMaintainProItems.length} local part(s) have no ERP item code match.`);
  }

  return {
    summary: {
      matchedItems: matchedRows.length,
      unmatchedErpItems: unmatchedErpItems.length,
      unmatchedMaintainProItems: unmatchedMaintainProItems.length,
      changedItems: changedRows.length,
      unchangedItems: matchedRows.length - changedRows.length
    },
    matchedRows,
    changedRows,
    unmatchedErpItems,
    unmatchedMaintainProItems,
    warnings
  };
}

export function buildDryRunResult(input: {
  mode: string;
  status: ErpStockSyncStatus;
  comparison: ReturnType<typeof compareStockBalances>;
  applyEnabled: boolean;
  message: string;
}): ErpStockSyncDryRunResult {
  return {
    mode: input.mode,
    status: input.status,
    checkedAt: new Date().toISOString(),
    summary: input.comparison.summary,
    warnings: input.comparison.warnings,
    sampleRows: input.comparison.matchedRows.slice(0, ERP_STOCK_SYNC_SAMPLE_LIMIT),
    changedRows: input.comparison.changedRows.slice(0, ERP_STOCK_SYNC_SAMPLE_LIMIT),
    unmatchedErpSamples: input.comparison.unmatchedErpItems.slice(0, ERP_STOCK_SYNC_SAMPLE_LIMIT),
    unmatchedMaintainProSamples: input.comparison.unmatchedMaintainProItems.slice(
      0,
      ERP_STOCK_SYNC_SAMPLE_LIMIT
    ),
    applyEnabled: input.applyEnabled,
    message: input.message
  };
}

export function publicErpStockSyncDryRunHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !PUBLIC_DRY_RUN_KEYS.has(key))) {
    return true;
  }

  const serialized = JSON.stringify(record);
  return /erp_api_key|api[_-]?key|authorization|secret|token|smtp_pass/i.test(serialized);
}

export function parseBileetaStockBalances(payload: unknown): StockBalanceSnapshot[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown[] }).items)
      ? ((payload as { items: unknown[] }).items ?? [])
      : [];

  return rows
    .map((row): StockBalanceSnapshot | null => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const record = row as Record<string, unknown>;
      const partSku = String(
        record.itemCode ?? record.partSku ?? record.partNumber ?? record.sku ?? ""
      ).trim();
      const quantityRaw = record.quantityOnHand ?? record.quantity ?? record.qty ?? record.onHand;
      const quantityOnHand = Number(quantityRaw);

      if (!partSku || Number.isNaN(quantityOnHand)) {
        return null;
      }

      const warehouseCode =
        typeof record.warehouseCode === "string"
          ? record.warehouseCode
          : typeof record.warehouse === "string"
            ? record.warehouse
            : undefined;

      return {
        partSku,
        quantityOnHand,
        warehouseCode
      };
    })
    .filter((row): row is StockBalanceSnapshot => row !== null);
}
