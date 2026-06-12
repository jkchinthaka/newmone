import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppSettingScope, Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

export interface PushDeviceRegistration {
  installationId: string;
  token: string;
  platform: string;
  provider: string;
  appVersion: string | null;
  locale: string | null;
  deviceName: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface PushProviderSummary {
  id: string;
  configured: boolean;
  mode: "disabled" | "mock" | "active" | "misconfigured";
  description: string;
}

type PushDispatchPayload = {
  userId: string;
  title?: string;
  message: string;
  notificationId?: string;
  metadata?: Prisma.JsonValue | null;
};

type PushProviderPayload = PushDispatchPayload & {
  devices: PushDeviceRegistration[];
};

type PushDeliveryResult = {
  providerId: string;
  attempted: number;
  delivered: number;
  skipped: number;
  mode: "disabled" | "mock" | "active" | "misconfigured";
};

@Injectable()
export class NoopPushProvider {
  private readonly logger = new Logger(NoopPushProvider.name);

  describe(): PushProviderSummary {
    return {
      id: "noop",
      configured: false,
      mode: "mock",
      description: "Mock push provider is enabled (no external push vendor calls)"
    };
  }

  async dispatch(payload: PushProviderPayload): Promise<PushDeliveryResult> {
    if (payload.devices.length > 0) {
      this.logger.log(
        `Prepared ${payload.devices.length} push notification(s) for user ${payload.userId} in log-only mode`
      );
    }

    return {
      providerId: "noop",
      attempted: payload.devices.length,
      delivered: 0,
      skipped: payload.devices.length,
      mode: "mock"
    };
  }
}

@Injectable()
export class HttpPushProvider {
  private readonly logger = new Logger(HttpPushProvider.name);

  constructor(private readonly configService: ConfigService) {}

  describe(): PushProviderSummary {
    const configured = this.isConfigured();
    return {
      id: this.providerId,
      configured,
      mode: configured ? "active" : "misconfigured",
      description: configured
        ? "Generic HTTP push provider is configured"
        : "PUSH_MODE=live but required push provider settings are missing"
    };
  }

  async dispatch(payload: PushProviderPayload): Promise<PushDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        providerId: this.providerId,
        attempted: 0,
        delivered: 0,
        skipped: payload.devices.length,
        mode: "misconfigured"
      };
    }

    const endpoint = this.configService.get<string>("PUSH_PROVIDER_API_URL", "");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify({
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        notificationId: payload.notificationId ?? null,
        metadata: payload.metadata ?? null,
        devices: payload.devices.map((device) => ({
          installationId: device.installationId,
          token: device.token,
          platform: device.platform,
          provider: device.provider,
          appVersion: device.appVersion,
          locale: device.locale
        }))
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Push provider returned HTTP ${response.status}${body ? `: ${body}` : ""}`);
    }

    this.logger.log(`Delivered push payload to ${payload.devices.length} device(s) via ${this.providerId}`);
    return {
      providerId: this.providerId,
      attempted: payload.devices.length,
      delivered: payload.devices.length,
      skipped: 0,
      mode: "active"
    };
  }

  private get providerId(): string {
    return this.configService.get<string>("PUSH_PROVIDER", "generic-http").trim() || "generic-http";
  }

  private isConfigured(): boolean {
    return ["PUSH_PROVIDER_API_URL", "PUSH_PROVIDER_API_KEY"].every((key) => this.hasConfigValue(key));
  }

  private buildHeaders(): Record<string, string> {
    const headerName = this.configService.get<string>("PUSH_PROVIDER_AUTH_HEADER", "Authorization");
    const apiKey = this.configService.get<string>("PUSH_PROVIDER_API_KEY", "");

    return {
      "Content-Type": "application/json",
      [headerName]: headerName.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey
    };
  }

  private hasConfigValue(key: string): boolean {
    const value = this.configService.get<string | number | boolean | undefined>(key);
    return value !== undefined && String(value).trim().length > 0;
  }
}

@Injectable()
export class PushDispatchService {
  private readonly pushDevicesSettingKey = "notifications.push.devices";

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly noopPushProvider: NoopPushProvider,
    private readonly httpPushProvider: HttpPushProvider
  ) {}

  async dispatch(payload: PushDispatchPayload) {
    if (this.mode === "disabled") {
      return {
        deviceCount: 0,
        deliveries: [
          {
            providerId: "push-disabled",
            attempted: 0,
            delivered: 0,
            skipped: 0,
            mode: "disabled" as const
          }
        ]
      };
    }
    if (this.mode === "mock" && !this.isMockAllowed()) {
      throw new Error("Push mock mode is blocked in production unless ALLOW_MOCK_IN_PRODUCTION=true");
    }

    const devices = await this.getRegisteredDevices(payload.userId);
    if (devices.length === 0) {
      return {
        deviceCount: 0,
        deliveries: [] as PushDeliveryResult[]
      };
    }

    const deliveries = await Promise.all(
      this.providers.map((provider) =>
        provider.dispatch({
          ...payload,
          devices
        })
      )
    );

    return {
      deviceCount: devices.length,
      deliveries
    };
  }

  describeProviders(): PushProviderSummary[] {
    if (this.mode === "disabled") {
      return [
        {
          id: "push-disabled",
          configured: false,
          mode: "disabled",
          description: "Push delivery is disabled by PUSH_MODE=disabled"
        }
      ];
    }
    if (this.mode === "mock" && !this.isMockAllowed()) {
      return [
        {
          id: "push-mock-blocked",
          configured: false,
          mode: "misconfigured",
          description: "Push mock mode is blocked in production unless ALLOW_MOCK_IN_PRODUCTION=true"
        }
      ];
    }
    return this.providers.map((provider) => provider.describe());
  }

  async getRegisteredDevices(userId: string): Promise<PushDeviceRegistration[]> {
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        scope_scopeId_key: {
          scope: AppSettingScope.USER,
          scopeId: userId,
          key: this.pushDevicesSettingKey
        }
      }
    });

    return this.normalizeDeviceRegistrations(setting?.value);
  }

  maskDevices(devices: PushDeviceRegistration[]) {
    return devices.map((device) => ({
      ...device,
      token: this.maskToken(device.token)
    }));
  }

  private normalizeDeviceRegistrations(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => this.normalizeDevice(entry))
      .filter((entry): entry is PushDeviceRegistration => entry !== null);
  }

  private normalizeDevice(value: unknown): PushDeviceRegistration | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, unknown>;
    const installationId = (record.installationId ?? "").toString().trim();
    const token = (record.token ?? "").toString().trim();

    if (!installationId || !token) {
      return null;
    }

    return {
      installationId,
      token,
      platform: (record.platform ?? "unknown").toString(),
      provider: (record.provider ?? "UNKNOWN").toString(),
      appVersion: this.optionalString(record.appVersion),
      locale: this.optionalString(record.locale),
      deviceName: this.optionalString(record.deviceName),
      createdAt: this.optionalIso(record.createdAt) ?? new Date(0).toISOString(),
      lastSeenAt: this.optionalIso(record.lastSeenAt) ?? new Date(0).toISOString()
    };
  }

  private optionalString(value: unknown): string | null {
    const text = value?.toString().trim() ?? "";
    return text.length > 0 ? text : null;
  }

  private optionalIso(value: unknown): string | null {
    const text = this.optionalString(value);
    if (!text) {
      return null;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private maskToken(token: string): string {
    if (token.length <= 12) {
      return token;
    }

    return `${token.slice(0, 6)}...${token.slice(-4)}`;
  }

  private get providers() {
    if (this.mode === "mock") {
      return [this.noopPushProvider];
    }

    return [this.httpPushProvider];
  }

  private get mode(): "disabled" | "mock" | "live" {
    const explicit = this.prismaConfigMode();
    if (explicit) return explicit;
    return this.configService.get<boolean>("PUSH_PROVIDER_ENABLED", false) ? "live" : "disabled";
  }

  private prismaConfigMode(): "disabled" | "mock" | "live" | null {
    const explicit = this.configService
      .get<string>("PUSH_MODE", "")
      .trim()
      .toLowerCase();
    if (explicit === "disabled" || explicit === "mock" || explicit === "live") {
      return explicit;
    }
    return null;
  }

  private isMockAllowed(): boolean {
    const isProduction = this.configService.get<string>("NODE_ENV", "development") === "production";
    if (!isProduction) return true;
    return this.configService.get<boolean>("ALLOW_MOCK_IN_PRODUCTION", false);
  }
}