import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  InventoryErpMode,
  StockBalanceSnapshot
} from "./inventory-erp-adapter.service";
import { ErpStockSyncReadiness, parseBileetaStockBalances } from "./erp-stock-sync.mapper";

const MOCK_BALANCES: StockBalanceSnapshot[] = [
  { partSku: "BRG-001", quantityOnHand: 12, warehouseCode: "MAIN" },
  { partSku: "FLT-220", quantityOnHand: 4, warehouseCode: "MAIN" },
  { partSku: "SEAL-88", quantityOnHand: 0, warehouseCode: "MAIN" }
];

@Injectable()
export class BileetaInventoryErpAdapter {
  private readonly logger = new Logger(BileetaInventoryErpAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  checkReadiness(): ErpStockSyncReadiness {
    const mode = this.resolveMode();
    const baseUrl = this.resolveBaseUrl();
    const credentialPresent = this.hasConfigValue("ERP_API_KEY");
    const stockEndpointPresent = this.hasConfigValue("ERP_STOCK_ENDPOINT");
    const readOnlySyncEnabled = this.isReadOnlySyncEnabled();
    const applyEnabled = this.isApplyEnabled();
    const missingKeys = this.missingLiveKeys();

    if (mode === "disabled") {
      return {
        adapterId: "BILEETA_INVENTORY_ERP",
        mode,
        state: "disabled",
        readOnlySyncEnabled,
        applyEnabled,
        stockEndpointPresent,
        baseUrlPresent: Boolean(baseUrl),
        credentialPresent,
        message: "Bileeta stock sync is disabled by ERP_MODE=disabled",
        missingKeys: []
      };
    }

    if (mode === "mock") {
      const blockedInProduction = this.isProduction() && !this.isMockAllowed();
      return {
        adapterId: "BILEETA_INVENTORY_ERP",
        mode,
        state: blockedInProduction ? "misconfigured" : "configured",
        readOnlySyncEnabled,
        applyEnabled,
        stockEndpointPresent,
        baseUrlPresent: Boolean(baseUrl),
        credentialPresent,
        message: blockedInProduction
          ? "Mock Bileeta stock sync is blocked in production unless explicitly allowed"
          : "Mock Bileeta stock sync adapter is enabled for dry-run testing",
        missingKeys: []
      };
    }

    if (!readOnlySyncEnabled) {
      return {
        adapterId: "BILEETA_INVENTORY_ERP",
        mode,
        state: "disabled",
        readOnlySyncEnabled: false,
        applyEnabled,
        stockEndpointPresent,
        baseUrlPresent: Boolean(baseUrl),
        credentialPresent,
        message: "ERP read-only stock sync is disabled. Set ERP_READ_ONLY_SYNC_ENABLED=true.",
        missingKeys: ["ERP_READ_ONLY_SYNC_ENABLED"]
      };
    }

    if (missingKeys.length >= 3) {
      return {
        adapterId: "BILEETA_INVENTORY_ERP",
        mode,
        state: "not_configured",
        readOnlySyncEnabled,
        applyEnabled,
        stockEndpointPresent,
        baseUrlPresent: Boolean(baseUrl),
        credentialPresent,
        message: "Bileeta stock sync settings are missing",
        missingKeys
      };
    }

    if (missingKeys.length > 0) {
      return {
        adapterId: "BILEETA_INVENTORY_ERP",
        mode,
        state: "misconfigured",
        readOnlySyncEnabled,
        applyEnabled,
        stockEndpointPresent,
        baseUrlPresent: Boolean(baseUrl),
        credentialPresent,
        message: "Bileeta stock sync settings are incomplete",
        missingKeys
      };
    }

    return {
      adapterId: "BILEETA_INVENTORY_ERP",
      mode,
      state: "configured",
      readOnlySyncEnabled,
      applyEnabled,
      stockEndpointPresent: true,
      baseUrlPresent: true,
      credentialPresent: true,
      message:
        mode === "sandbox"
          ? "Bileeta sandbox stock sync is configured for read-only dry-run"
          : "Bileeta live stock sync is configured for read-only dry-run",
      missingKeys: []
    };
  }

  async fetchStockBalances(): Promise<{
    ok: boolean;
    mode: string;
    message: string;
    balances: StockBalanceSnapshot[];
  }> {
    const readiness = this.checkReadiness();
    const mode = readiness.mode;

    if (readiness.state === "disabled" || readiness.state === "not_configured") {
      return {
        ok: false,
        mode,
        message: readiness.message,
        balances: []
      };
    }

    if (readiness.state === "misconfigured") {
      return {
        ok: false,
        mode,
        message: readiness.message,
        balances: []
      };
    }

    if (mode === "mock") {
      return {
        ok: true,
        mode,
        message: "Mock Bileeta stock balances returned for dry-run comparison",
        balances: MOCK_BALANCES
      };
    }

    try {
      const balances = await this.fetchLiveStockBalances();
      return {
        ok: true,
        mode,
        message: `Fetched ${balances.length} Bileeta stock balance row(s)`,
        balances
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bileeta stock fetch failed";
      this.logger.warn(`Bileeta stock fetch failed: ${message}`);
      return {
        ok: false,
        mode,
        message,
        balances: []
      };
    }
  }

  private async fetchLiveStockBalances(): Promise<StockBalanceSnapshot[]> {
    const baseUrl = this.resolveBaseUrl().replace(/\/+$/, "");
    const endpoint = this.configService.get<string>("ERP_STOCK_ENDPOINT", "").trim();
    const url = new URL(`${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);

    const warehouseCode = this.configService.get<string>("ERP_WAREHOUSE_CODE", "").trim();
    const tenantCode = this.configService.get<string>("ERP_TENANT_CODE", "").trim();
    if (warehouseCode) {
      url.searchParams.set("warehouse", warehouseCode);
    }
    if (tenantCode) {
      url.searchParams.set("tenant", tenantCode);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.configService.get<number>("ERP_TIMEOUT_MS", 15_000))
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Bileeta stock endpoint returned HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
    }

    const payload = await response.json();
    return parseBileetaStockBalances(payload);
  }

  private buildHeaders(): Record<string, string> {
    const headerName = this.configService.get<string>("ERP_AUTH_HEADER", "Authorization");
    const apiKey = this.configService.get<string>("ERP_API_KEY", "");

    return {
      Accept: "application/json",
      [headerName]:
        headerName.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey
    };
  }

  private resolveMode(): InventoryErpMode | "sandbox" {
    const explicit = this.configService.get<string>("ERP_MODE", "").trim().toLowerCase();
    if (explicit === "disabled" || explicit === "mock" || explicit === "live" || explicit === "sandbox") {
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
    const missing: string[] = [];
    if (!this.resolveBaseUrl()) {
      missing.push("ERP_BASE_URL");
    }
    if (!this.hasConfigValue("ERP_API_KEY")) {
      missing.push("ERP_API_KEY");
    }
    if (!this.hasConfigValue("ERP_STOCK_ENDPOINT")) {
      missing.push("ERP_STOCK_ENDPOINT");
    }
    return missing;
  }

  private isReadOnlySyncEnabled(): boolean {
    return this.configService.get<boolean>("ERP_READ_ONLY_SYNC_ENABLED", false);
  }

  private isApplyEnabled(): boolean {
    return this.configService.get<boolean>("ERP_STOCK_SYNC_APPLY_ENABLED", false);
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
