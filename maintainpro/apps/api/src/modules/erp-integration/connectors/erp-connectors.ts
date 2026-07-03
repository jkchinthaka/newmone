import { ConfigService } from "@nestjs/config";

import { ERP_LIVE_NOT_CONFIGURED_MESSAGE, MOCK_ERP_SAMPLE } from "../erp.constants";
import type { ErpConnectionStatus, ErpConnector, ErpConnectorResult } from "./erp-connector.interface";

function result(entity: string, records: unknown[]): ErpConnectorResult {
  return { entity, count: records.length, records, readOnly: true };
}

export class DisabledErpConnector implements ErpConnector {
  async getConnectionStatus(): Promise<ErpConnectionStatus> {
    return {
      connected: false,
      mode: "disabled",
      provider: "Bileeta",
      message: "ERP sync is disabled (ERP_SYNC_MODE=disabled)"
    };
  }

  private blocked(): never {
    throw new Error("ERP sync is disabled. Set ERP_SYNC_MODE to mock or file_import for non-production integration.");
  }

  async fetchEmployees() {
    return this.blocked();
  }
  async fetchVendors() {
    return this.blocked();
  }
  async fetchItems() {
    return this.blocked();
  }
  async fetchStockBalances() {
    return this.blocked();
  }
  async fetchAssets() {
    return this.blocked();
  }
  async fetchVehicles() {
    return this.blocked();
  }
  async fetchPurchaseOrders() {
    return this.blocked();
  }
  async fetchInvoices() {
    return this.blocked();
  }
  async pushWorkOrderCost() {
    return this.blocked();
  }
  async pushPartsIssue() {
    return this.blocked();
  }
  async pushVendorRepairStatus() {
    return this.blocked();
  }
}

export class MockErpConnector implements ErpConnector {
  async getConnectionStatus(): Promise<ErpConnectionStatus> {
    return {
      connected: true,
      mode: "mock",
      provider: "Bileeta",
      message: "Using local mock ERP sample data (no external API calls)"
    };
  }

  fetchEmployees = async () => result("employees", MOCK_ERP_SAMPLE.employees);
  fetchVendors = async () => result("vendors", MOCK_ERP_SAMPLE.vendors);
  fetchItems = async () => result("items", MOCK_ERP_SAMPLE.items);
  fetchStockBalances = async () => result("stockBalances", MOCK_ERP_SAMPLE.stockBalances);
  fetchAssets = async () => result("assets", MOCK_ERP_SAMPLE.assets);
  fetchVehicles = async () => result("vehicles", MOCK_ERP_SAMPLE.vehicles);
  fetchPurchaseOrders = async () => result("purchaseOrders", MOCK_ERP_SAMPLE.purchaseOrders);
  fetchInvoices = async () => result("invoices", MOCK_ERP_SAMPLE.invoices);

  pushWorkOrderCost = async () => ({
    accepted: false,
    message: "Mock mode does not push costs to ERP"
  });
  pushPartsIssue = async () => ({
    accepted: false,
    message: "Mock mode does not push parts issues to ERP"
  });
  pushVendorRepairStatus = async () => ({
    accepted: false,
    message: "Mock mode does not push vendor repair status to ERP"
  });
}

export class FileImportErpConnector implements ErpConnector {
  async getConnectionStatus(): Promise<ErpConnectionStatus> {
    return {
      connected: true,
      mode: "file_import",
      provider: "Bileeta",
      message: "File import mode — use import batches for CSV/manual data (no live API)"
    };
  }

  private fileOnly(entity: string): ErpConnectorResult {
    return { entity, count: 0, records: [], readOnly: true };
  }

  fetchEmployees = async () => this.fileOnly("employees");
  fetchVendors = async () => this.fileOnly("vendors");
  fetchItems = async () => this.fileOnly("items");
  fetchStockBalances = async () => this.fileOnly("stockBalances");
  fetchAssets = async () => this.fileOnly("assets");
  fetchVehicles = async () => this.fileOnly("vehicles");
  fetchPurchaseOrders = async () => this.fileOnly("purchaseOrders");
  fetchInvoices = async () => this.fileOnly("invoices");

  pushWorkOrderCost = async () => ({
    accepted: false,
    message: "File import mode does not push to ERP API"
  });
  pushPartsIssue = async () => ({
    accepted: false,
    message: "File import mode does not push to ERP API"
  });
  pushVendorRepairStatus = async () => ({
    accepted: false,
    message: "File import mode does not push to ERP API"
  });
}

export class BileetaErpConnector implements ErpConnector {
  constructor(private readonly configService: ConfigService) {}

  private assertLiveConfigured(): never {
    const baseUrl = this.configService.get<string>("BILEETA_API_BASE_URL") ?? this.configService.get<string>("ERP_API_URL");
    const hasCreds =
      Boolean(baseUrl?.trim()) &&
      (Boolean(this.configService.get<string>("BILEETA_API_KEY")?.trim()) ||
        (Boolean(this.configService.get<string>("BILEETA_API_USERNAME")?.trim()) &&
          Boolean(this.configService.get<string>("BILEETA_API_PASSWORD")?.trim())));

    if (!hasCreds) {
      throw new Error(ERP_LIVE_NOT_CONFIGURED_MESSAGE);
    }
    throw new Error(
      "Bileeta live API connector is reserved for approved integration. Real API calls are not enabled in this build."
    );
  }

  getConnectionStatus = async (): Promise<ErpConnectionStatus> => {
    try {
      this.assertLiveConfigured();
    } catch (e) {
      return {
        connected: false,
        mode: "live",
        provider: "Bileeta",
        message: e instanceof Error ? e.message : ERP_LIVE_NOT_CONFIGURED_MESSAGE
      };
    }
  };

  fetchEmployees = async () => this.assertLiveConfigured();
  fetchVendors = async () => this.assertLiveConfigured();
  fetchItems = async () => this.assertLiveConfigured();
  fetchStockBalances = async () => this.assertLiveConfigured();
  fetchAssets = async () => this.assertLiveConfigured();
  fetchVehicles = async () => this.assertLiveConfigured();
  fetchPurchaseOrders = async () => this.assertLiveConfigured();
  fetchInvoices = async () => this.assertLiveConfigured();
  pushWorkOrderCost = async () => this.assertLiveConfigured();
  pushPartsIssue = async () => this.assertLiveConfigured();
  pushVendorRepairStatus = async () => this.assertLiveConfigured();
}

export type ErpSyncModeKey = "disabled" | "mock" | "file_import" | "live";

export function resolveErpSyncMode(configService: ConfigService): ErpSyncModeKey {
  const raw = (configService.get<string>("ERP_SYNC_MODE") ?? "disabled").toLowerCase();
  if (raw === "mock" || raw === "file_import" || raw === "live" || raw === "disabled") return raw;
  return "disabled";
}

export function createErpConnector(configService: ConfigService): ErpConnector {
  const mode = resolveErpSyncMode(configService);
  switch (mode) {
    case "mock":
      return new MockErpConnector();
    case "file_import":
      return new FileImportErpConnector();
    case "live":
      return new BileetaErpConnector(configService);
    default:
      return new DisabledErpConnector();
  }
}
