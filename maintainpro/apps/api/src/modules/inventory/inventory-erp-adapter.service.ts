import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type InventoryErpMode = "disabled" | "mock" | "live";

export type InventoryErpReadinessState = "disabled" | "not_configured" | "misconfigured" | "configured";

export type InventoryErpReadiness = {
  adapterId: string;
  mode: InventoryErpMode;
  state: InventoryErpReadinessState;
  configured: boolean;
  blockedInProduction: boolean;
  baseUrlPresent: boolean;
  credentialPresent: boolean;
  message: string;
  missingKeys: string[];
};

export type InventoryErpResult<T> = {
  ok: boolean;
  mode: InventoryErpMode;
  message: string;
  data?: T;
};

export type StockBalanceSnapshot = {
  partSku: string;
  quantityOnHand: number;
  warehouseCode?: string | null;
};

export type PartCatalogSyncSummary = {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
};

export type PurchaseOrderStatusSnapshot = {
  poNumber: string;
  status: string;
  providerRef?: string | null;
};

export type WorkOrderPartRequestSyncSummary = {
  requestId: string;
  status: string;
  providerRef?: string | null;
};

export interface InventoryErpAdapter {
  describeReadiness(): InventoryErpReadiness;
  getStockBalance(partSku: string): Promise<InventoryErpResult<StockBalanceSnapshot>>;
  syncPartCatalog(): Promise<InventoryErpResult<PartCatalogSyncSummary>>;
  syncPurchaseOrderStatus(poNumber: string): Promise<InventoryErpResult<PurchaseOrderStatusSnapshot>>;
  syncWorkOrderPartRequest(requestId: string): Promise<InventoryErpResult<WorkOrderPartRequestSyncSummary>>;
}

const LIVE_KEYS = ["ERP_API_KEY"] as const;

@Injectable()
export class DisabledInventoryErpAdapter implements InventoryErpAdapter {
  constructor(private readonly configService: ConfigService) {}

  describeReadiness(): InventoryErpReadiness {
    const mode = this.resolveMode();
    const baseUrl = this.resolveBaseUrl();
    const credentialPresent = this.hasConfigValue("ERP_API_KEY");
    const missingKeys = this.missingLiveKeys();

    if (mode === "disabled") {
      return {
        adapterId: "INVENTORY_ERP_DISABLED",
        mode,
        state: "disabled",
        configured: false,
        blockedInProduction: false,
        baseUrlPresent: Boolean(baseUrl),
        credentialPresent,
        message: "Inventory ERP adapter is disabled by ERP_MODE=disabled",
        missingKeys: []
      };
    }

    if (mode === "mock") {
      const blockedInProduction = this.isProduction() && !this.isMockAllowed();
      return {
        adapterId: "INVENTORY_ERP_MOCK",
        mode,
        state: blockedInProduction ? "misconfigured" : "configured",
        configured: !blockedInProduction,
        blockedInProduction,
        baseUrlPresent: Boolean(baseUrl),
        credentialPresent,
        message: blockedInProduction
          ? "Mock inventory ERP is blocked in production unless explicitly allowed"
          : "Mock inventory ERP adapter is enabled for non-destructive development/testing",
        missingKeys: []
      };
    }

    if (missingKeys.length >= 2) {
      return {
        adapterId: "INVENTORY_ERP_LIVE",
        mode,
        state: "not_configured",
        configured: false,
        blockedInProduction: false,
        baseUrlPresent: Boolean(baseUrl),
        credentialPresent,
        message: "ERP_MODE=live but inventory ERP credentials/base URL are missing",
        missingKeys
      };
    }

    if (missingKeys.length > 0 || !baseUrl) {
      return {
        adapterId: "INVENTORY_ERP_LIVE",
        mode,
        state: "misconfigured",
        configured: false,
        blockedInProduction: false,
        baseUrlPresent: Boolean(baseUrl),
        credentialPresent,
        message: "ERP_MODE=live but inventory ERP settings are incomplete",
        missingKeys: !baseUrl ? ["ERP_BASE_URL", "ERP_API_URL", ...missingKeys] : missingKeys
      };
    }

    return {
      adapterId: "INVENTORY_ERP_LIVE",
      mode,
      state: "configured",
      configured: true,
      blockedInProduction: false,
      baseUrlPresent: true,
      credentialPresent: true,
      message: "Live inventory ERP adapter settings are present (sync remains disabled in this foundation sprint)",
      missingKeys: []
    };
  }

  async getStockBalance(partSku: string): Promise<InventoryErpResult<StockBalanceSnapshot>> {
    return this.disabledResult(`Stock balance lookup blocked for SKU ${partSku}`);
  }

  async syncPartCatalog(): Promise<InventoryErpResult<PartCatalogSyncSummary>> {
    return this.disabledResult("Part catalog sync is disabled in the current adapter foundation");
  }

  async syncPurchaseOrderStatus(poNumber: string): Promise<InventoryErpResult<PurchaseOrderStatusSnapshot>> {
    return this.disabledResult(`Purchase order status sync blocked for ${poNumber}`);
  }

  async syncWorkOrderPartRequest(
    requestId: string
  ): Promise<InventoryErpResult<WorkOrderPartRequestSyncSummary>> {
    return this.disabledResult(`Work order part request sync blocked for ${requestId}`);
  }

  private disabledResult<T>(message: string): InventoryErpResult<T> {
    return {
      ok: false,
      mode: this.resolveMode(),
      message
    };
  }

  private resolveMode(): InventoryErpMode {
    const explicit = this.configService.get<string>("ERP_MODE", "").trim().toLowerCase();
    if (explicit === "disabled" || explicit === "mock" || explicit === "live") {
      return explicit;
    }

    const legacy = this.configService.get<string>("ERP_SYNC_PROVIDER", "mock").trim().toLowerCase();
    return legacy === "http" || legacy === "real" ? "live" : "mock";
  }

  private resolveBaseUrl(): string {
    return (
      this.configService.get<string>("ERP_BASE_URL", "").trim() ||
      this.configService.get<string>("ERP_API_URL", "").trim()
    );
  }

  private missingLiveKeys(): string[] {
    const missing: string[] = LIVE_KEYS.filter((key) => !this.hasConfigValue(key));
    if (!this.resolveBaseUrl()) {
      missing.unshift("ERP_BASE_URL");
    }
    return missing;
  }

  private isProduction(): boolean {
    return this.configService.get<string>("NODE_ENV", "development") === "production";
  }

  private isMockAllowed(): boolean {
    return (
      this.configService.get<boolean>("ALLOW_MOCK_IN_PRODUCTION", false) ||
      this.configService.get<boolean>("ERP_SYNC_ALLOW_MOCK_IN_PRODUCTION", false)
    );
  }

  private hasConfigValue(key: string): boolean {
    const value = this.configService.get<string | number | boolean | undefined>(key);
    return value !== undefined && String(value).trim().length > 0;
  }
}

@Injectable()
export class InventoryErpAdapterService {
  constructor(private readonly disabledAdapter: DisabledInventoryErpAdapter) {}

  describeReadiness(): InventoryErpReadiness {
    return this.disabledAdapter.describeReadiness();
  }

  getStockBalance(partSku: string): Promise<InventoryErpResult<StockBalanceSnapshot>> {
    return this.disabledAdapter.getStockBalance(partSku);
  }

  syncPartCatalog(): Promise<InventoryErpResult<PartCatalogSyncSummary>> {
    return this.disabledAdapter.syncPartCatalog();
  }

  syncPurchaseOrderStatus(poNumber: string): Promise<InventoryErpResult<PurchaseOrderStatusSnapshot>> {
    return this.disabledAdapter.syncPurchaseOrderStatus(poNumber);
  }

  syncWorkOrderPartRequest(
    requestId: string
  ): Promise<InventoryErpResult<WorkOrderPartRequestSyncSummary>> {
    return this.disabledAdapter.syncWorkOrderPartRequest(requestId);
  }
}
