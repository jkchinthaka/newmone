import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../database/prisma.service";

type SmsDispatchPayload = {
  userId: string;
  message: string;
  notificationId?: string;
};

type SmsDeliveryResult = {
  providerId: string;
  attempted: number;
  delivered: number;
  skipped: number;
  mode: "disabled" | "mock" | "active" | "misconfigured";
};

export type SmsProviderSummary = {
  id: string;
  configured: boolean;
  mode: "disabled" | "mock" | "active" | "misconfigured";
  description: string;
};

@Injectable()
export class SmsDispatchService {
  private readonly logger = new Logger(SmsDispatchService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  describeProvider(): SmsProviderSummary {
    const mode = this.integrationMode;
    if (mode === "disabled") {
      return {
        id: "generic-http-sms",
        configured: false,
        mode: "disabled",
        description: "SMS delivery is disabled by SMS_MODE=disabled"
      };
    }
    if (mode === "mock") {
      if (!this.isMockAllowed()) {
        return {
          id: "mock-sms",
          configured: false,
          mode: "misconfigured",
          description: "SMS mock mode is blocked in production unless ALLOW_MOCK_IN_PRODUCTION=true"
        };
      }
      return {
        id: "mock-sms",
        configured: true,
        mode: "mock",
        description: "SMS delivery is in mock mode"
      };
    }
    const configured = this.hasLiveConfig();
    return {
      id: "generic-http-sms",
      configured,
      mode: configured ? "active" : "misconfigured",
      description: configured
        ? "Generic HTTP SMS provider is configured"
        : "SMS_MODE=live but required SMS provider settings are missing"
    };
  }

  async dispatch(payload: SmsDispatchPayload): Promise<SmsDeliveryResult> {
    const mode = this.integrationMode;
    if (mode === "disabled") {
      this.logger.warn(`Skipped SMS notification for user ${payload.userId}: SMS_MODE=disabled`);
      return this.result(0, 0, 1, "disabled");
    }

    if (mode === "mock") {
      if (!this.isMockAllowed()) {
        throw new Error("SMS mock mode is blocked in production unless ALLOW_MOCK_IN_PRODUCTION=true");
      }
      this.logger.warn(`Mock SMS delivery for user ${payload.userId}: no external SMS sent`);
      return this.result(1, 0, 1, "mock");
    }

    if (!this.hasLiveConfig()) {
      this.logger.error(
        `SMS dispatch misconfigured for user ${payload.userId}: SMS_MODE=live but provider settings are incomplete`
      );
      throw new Error("SMS_MODE=live requires SMS_API_URL, SMS_API_KEY, and SMS_SENDER_ID");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { phone: true }
    });

    if (!user?.phone) {
      this.logger.warn(`Skipped SMS notification for user ${payload.userId}: recipient phone is missing`);
      return this.result(0, 0, 1, "active");
    }

    const endpoint = this.configService.get<string>("SMS_API_URL", "");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify({
        to: user.phone,
        message: payload.message,
        senderId: this.configService.get<string>("SMS_SENDER_ID", "MaintainPro"),
        notificationId: payload.notificationId ?? null
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`SMS provider returned HTTP ${response.status}${body ? `: ${body}` : ""}`);
    }

    if (payload.notificationId) {
      await this.prisma.notification.update({
        where: { id: payload.notificationId },
        data: { sentAt: new Date() }
      });
    }

    this.logger.log(`Delivered SMS notification ${payload.notificationId ?? "(ad hoc)"} to ${user.phone}`);
    return this.result(1, 1, 0, "active");
  }

  async sendUatSms(input: { to: string; message: string }): Promise<{ messageId: string | null }> {
    const mode = this.integrationMode;
    if (mode === "disabled") {
      throw new Error("SMS delivery is disabled by SMS_MODE=disabled");
    }

    if (mode === "mock") {
      return { messageId: null };
    }

    if (!this.hasLiveConfig()) {
      throw new Error("SMS_MODE=live requires SMS_API_URL, SMS_API_KEY, and SMS_SENDER_ID");
    }

    const endpoint = this.configService.get<string>("SMS_API_URL", "");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify({
        to: input.to,
        message: input.message,
        senderId: this.configService.get<string>("SMS_SENDER_ID", "MaintainPro")
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`SMS provider returned HTTP ${response.status}${body ? `: ${body}` : ""}`);
    }

    let messageId: string | null = null;
    try {
      const payload = (await response.json()) as { messageId?: string; id?: string };
      messageId = payload.messageId ?? payload.id ?? null;
    } catch {
      messageId = null;
    }

    return { messageId };
  }

  private get integrationMode(): "disabled" | "mock" | "live" {
    const explicit = this.configService.get<string>("SMS_MODE", "").trim().toLowerCase();
    if (explicit === "disabled" || explicit === "mock" || explicit === "live") {
      return explicit;
    }
    // Backward compatibility with legacy SMS_ENABLED flag.
    return this.configService.get<boolean>("SMS_ENABLED", false) ? "live" : "disabled";
  }

  private hasLiveConfig(): boolean {
    return ["SMS_API_URL", "SMS_API_KEY", "SMS_SENDER_ID"].every((key) => this.hasConfigValue(key));
  }

  private isMockAllowed(): boolean {
    const isProduction = this.configService.get<string>("NODE_ENV", "development") === "production";
    if (!isProduction) {
      return true;
    }
    return this.configService.get<boolean>("ALLOW_MOCK_IN_PRODUCTION", false);
  }

  private buildHeaders(): Record<string, string> {
    const headerName = this.configService.get<string>("SMS_AUTH_HEADER", "Authorization");
    const apiKey = this.configService.get<string>("SMS_API_KEY", "");
    const apiSecret = this.configService.get<string>("SMS_API_SECRET", "");

    return {
      "Content-Type": "application/json",
      [headerName]: headerName.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey,
      ...(apiSecret ? { "X-SMS-API-SECRET": apiSecret } : {})
    };
  }

  private hasConfigValue(key: string): boolean {
    const value = this.configService.get<string | number | boolean | undefined>(key);
    return value !== undefined && String(value).trim().length > 0;
  }

  private result(
    attempted: number,
    delivered: number,
    skipped: number,
    mode: "disabled" | "mock" | "active" | "misconfigured"
  ): SmsDeliveryResult {
    return {
      providerId: "generic-http-sms",
      attempted,
      delivered,
      skipped,
      mode
    };
  }
}