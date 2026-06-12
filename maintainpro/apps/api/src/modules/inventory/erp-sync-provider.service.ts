import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type ErpProviderMode = "disabled" | "mock" | "live";

export type ErpProviderSummary = {
  providerId: string;
  mode: ErpProviderMode;
  configured: boolean;
  mockAllowedInProduction: boolean;
  blockedInProduction: boolean;
  description: string;
};

export type ErpSyncRequest = {
  poNumber: string;
  totalAmount: number;
  note?: string | null;
  supplier?: unknown;
  lines?: unknown;
};

export type ErpSyncResponse = {
  accepted: boolean;
  providerRef?: string;
  raw?: unknown;
};

@Injectable()
export class ErpSyncProviderService {
  constructor(private readonly configService: ConfigService) {}

  describeProvider(): ErpProviderSummary {
    const mode = this.mode;
    const blockedInProduction = mode === "mock" && !this.isMockAllowed();
    const configured =
      mode === "disabled"
        ? true
        : mode === "mock"
          ? !blockedInProduction
          : this.isHttpConfigured();

    return {
      providerId:
        mode === "disabled"
          ? "ERP_DISABLED"
          : mode === "mock"
            ? "MOCK_ERP"
            : this.configService.get<string>("ERP_PROVIDER_ID", "HTTP_ERP"),
      mode,
      configured,
      mockAllowedInProduction: this.mockAllowedInProduction,
      blockedInProduction,
      description:
        mode === "disabled"
          ? "ERP integration is disabled by ERP_MODE=disabled"
          : mode === "mock"
          ? configured
            ? "Mock ERP provider is enabled for this environment"
            : "Mock ERP provider is blocked in production unless explicitly allowed"
          : configured
            ? "Live ERP provider is configured"
            : "Live ERP provider is missing ERP_API_URL or ERP_API_KEY"
    };
  }

  assertCanUseSelectedProvider(): void {
    const summary = this.describeProvider();
    if (summary.mode === "disabled") {
      throw new Error("ERP integration is disabled (ERP_MODE=disabled)");
    }
    if (!summary.configured) {
      throw new Error(summary.description);
    }
  }

  async syncPurchaseOrder(payload: ErpSyncRequest): Promise<ErpSyncResponse> {
    if (this.mode !== "live") {
      throw new Error("Live ERP provider is not selected");
    }

    if (!this.isHttpConfigured()) {
      throw new Error("ERP_API_URL and ERP_API_KEY are required for live ERP sync");
    }

    const response = await fetch(this.configService.get<string>("ERP_API_URL", ""), {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.configService.get<number>("ERP_TIMEOUT_MS", 15_000))
    });

    const responseBody = await this.readResponse(response);

    if (!response.ok) {
      throw new Error(`ERP provider returned HTTP ${response.status}: ${this.summarize(responseBody)}`);
    }

    return {
      accepted: this.isAccepted(responseBody),
      providerRef: this.providerRef(responseBody),
      raw: responseBody
    };
  }

  get mode(): ErpProviderMode {
    const explicit = this.configService.get<string>("ERP_MODE", "").trim().toLowerCase();
    if (explicit === "disabled" || explicit === "mock" || explicit === "live") {
      return explicit;
    }

    // Backward compatibility with legacy ERP_SYNC_PROVIDER config.
    const legacy = this.configService.get<string>("ERP_SYNC_PROVIDER", "mock").trim().toLowerCase();
    return legacy === "http" || legacy === "real" ? "live" : "mock";
  }

  private isMockAllowed(): boolean {
    return this.configService.get<string>("NODE_ENV", "development") !== "production" || this.mockAllowedInProduction;
  }

  private get mockAllowedInProduction(): boolean {
    return (
      this.configService.get<boolean>("ALLOW_MOCK_IN_PRODUCTION", false) ||
      this.configService.get<boolean>("ERP_SYNC_ALLOW_MOCK_IN_PRODUCTION", false)
    );
  }

  private isHttpConfigured(): boolean {
    return ["ERP_API_URL", "ERP_API_KEY"].every((key) => this.hasConfigValue(key));
  }

  private buildHeaders(): Record<string, string> {
    const headerName = this.configService.get<string>("ERP_AUTH_HEADER", "Authorization");
    const apiKey = this.configService.get<string>("ERP_API_KEY", "");

    return {
      "Content-Type": "application/json",
      [headerName]: headerName.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey
    };
  }

  private async readResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private isAccepted(body: unknown): boolean {
    if (!body || typeof body !== "object") {
      return true;
    }

    const record = body as Record<string, unknown>;
    if (typeof record.accepted === "boolean") return record.accepted;
    if (typeof record.success === "boolean") return record.success;
    if (typeof record.ok === "boolean") return record.ok;
    return true;
  }

  private providerRef(body: unknown): string | undefined {
    if (!body || typeof body !== "object") {
      return undefined;
    }

    const record = body as Record<string, unknown>;
    return (record.providerRef ?? record.referenceId ?? record.id)?.toString();
  }

  private summarize(body: unknown): string {
    if (typeof body === "string") return body.slice(0, 300);
    try {
      return JSON.stringify(body).slice(0, 300);
    } catch {
      return "unparseable provider response";
    }
  }

  private hasConfigValue(key: string): boolean {
    const value = this.configService.get<string | number | boolean | undefined>(key);
    return value !== undefined && String(value).trim().length > 0;
  }
}