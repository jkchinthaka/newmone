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

export type ErpStockSyncDryRunResult = {
  mode: string;
  status: string;
  checkedAt: string;
  summary: {
    matchedItems: number;
    unmatchedErpItems: number;
    unmatchedMaintainProItems: number;
    changedItems: number;
    unchangedItems: number;
  };
  warnings: string[];
  sampleRows: Array<{
    partNumber: string;
    partName: string;
    maintainProQuantity: number;
    erpQuantity: number;
    delta: number;
  }>;
  changedRows: Array<{
    partNumber: string;
    maintainProQuantity: number;
    erpQuantity: number;
    delta: number;
  }>;
  unmatchedErpSamples: Array<{ itemCode: string; quantity: number | null; reason: string }>;
  unmatchedMaintainProSamples: Array<{ itemCode: string; quantity: number | null; reason: string }>;
  applyEnabled: boolean;
  message: string;
};

export type ErpStockSyncApplyResult = {
  mode: string;
  status: string;
  appliedAt: string;
  updatedCount: number;
  skippedCount: number;
  warnings: string[];
  message: string;
};

const ERP_SYNC_MANAGER_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "INVENTORY_KEEPER",
  "ASSET_MANAGER",
  "OPERATIONS_MANAGER",
  "PROCUREMENT_OFFICER"
]);

export function canAccessInventoryErpSync(role?: string | null): boolean {
  if (!role) {
    return false;
  }

  return ERP_SYNC_MANAGER_ROLES.has(role);
}

export function formatErpStockSyncSummary(result: ErpStockSyncDryRunResult): string {
  return `${result.summary.matchedItems} matched, ${result.summary.changedItems} changed, ${result.summary.unmatchedErpItems} ERP-only, ${result.summary.unmatchedMaintainProItems} local-only`;
}

export function inventoryErpSyncPayloadHasSecrets(value: unknown): boolean {
  if (!value) {
    return false;
  }

  const serialized = JSON.stringify(value);
  return /erp_api_key|api[_-]?key|authorization|secret|token|bearer/i.test(serialized);
}
