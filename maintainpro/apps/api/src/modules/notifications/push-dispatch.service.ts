import { Injectable, Logger } from "@nestjs/common";
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
  mode: "noop" | "active";
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
  mode: "noop" | "active";
};

@Injectable()
export class NoopPushProvider {
  private readonly logger = new Logger(NoopPushProvider.name);

  describe(): PushProviderSummary {
    return {
      id: "noop",
      configured: false,
      mode: "noop",
      description: "Log-only push provider placeholder for future FCM/APNs/Web Push wiring"
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
      mode: "noop"
    };
  }
}

@Injectable()
export class PushDispatchService {
  private readonly pushDevicesSettingKey = "notifications.push.devices";

  constructor(
    private readonly prisma: PrismaService,
    private readonly noopPushProvider: NoopPushProvider
  ) {}

  async dispatch(payload: PushDispatchPayload) {
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
    return [this.noopPushProvider];
  }
}