import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ERP_LIVE_NOT_CONFIGURED_MESSAGE } from "./erp.constants";
import { createErpConnector, resolveErpSyncMode } from "./connectors/erp-connectors";

export type SafeErpConfigStatus = {
  provider: string;
  syncMode: string;
  apiBaseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  usernameConfigured: boolean;
  passwordConfigured: boolean;
  credentialsConfigured: boolean;
  liveIntegrationAvailable: boolean;
  liveNotConfiguredMessage: string | null;
  connectionStatus: string;
  lastConnectionTest: string | null;
};

@Injectable()
export class ErpConfigService {
  constructor(private readonly configService: ConfigService) {}

  getSyncMode(): string {
    return resolveErpSyncMode(this.configService);
  }

  hasCredentials(): boolean {
    const baseUrl =
      this.configService.get<string>("BILEETA_API_BASE_URL")?.trim() ||
      this.configService.get<string>("ERP_API_URL")?.trim() ||
      this.configService.get<string>("ERP_BASE_URL")?.trim();
    const apiKey = this.configService.get<string>("BILEETA_API_KEY")?.trim() || this.configService.get<string>("ERP_API_KEY")?.trim();
    const username = this.configService.get<string>("BILEETA_API_USERNAME")?.trim();
    const password = this.configService.get<string>("BILEETA_API_PASSWORD")?.trim();
    return Boolean(baseUrl && (apiKey || (username && password)));
  }

  getSafeConfigStatus(): SafeErpConfigStatus {
    const syncMode = this.getSyncMode();
    const baseUrlConfigured = Boolean(
      this.configService.get<string>("BILEETA_API_BASE_URL")?.trim() ||
        this.configService.get<string>("ERP_API_URL")?.trim()
    );
    const apiKeyConfigured = Boolean(
      this.configService.get<string>("BILEETA_API_KEY")?.trim() || this.configService.get<string>("ERP_API_KEY")?.trim()
    );
    const usernameConfigured = Boolean(this.configService.get<string>("BILEETA_API_USERNAME")?.trim());
    const passwordConfigured = Boolean(this.configService.get<string>("BILEETA_API_PASSWORD")?.trim());
    const credentialsConfigured = this.hasCredentials();
    const liveIntegrationAvailable = syncMode === "live" && credentialsConfigured;

    return {
      provider: "Bileeta",
      syncMode,
      apiBaseUrlConfigured: baseUrlConfigured,
      apiKeyConfigured,
      usernameConfigured,
      passwordConfigured,
      credentialsConfigured,
      liveIntegrationAvailable,
      liveNotConfiguredMessage:
        syncMode === "live" && !credentialsConfigured ? ERP_LIVE_NOT_CONFIGURED_MESSAGE : null,
      connectionStatus: liveIntegrationAvailable ? "CONFIGURED_NOT_ENABLED" : syncMode === "disabled" ? "DISABLED" : "READY_FOR_MOCK_OR_IMPORT",
      lastConnectionTest: null
    };
  }

  async getConnectionStatus() {
    const connector = createErpConnector(this.configService);
    return connector.getConnectionStatus();
  }
}
