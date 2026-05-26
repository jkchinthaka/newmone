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
  mode: "noop" | "active";
};

export type SmsProviderSummary = {
  id: string;
  configured: boolean;
  mode: "noop" | "active";
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
    const configured = this.isConfigured();
    return {
      id: "generic-http-sms",
      configured,
      mode: configured ? "active" : "noop",
      description: configured
        ? "Generic HTTP SMS provider is configured"
        : "SMS delivery is disabled or missing provider settings"
    };
  }

  async dispatch(payload: SmsDispatchPayload): Promise<SmsDeliveryResult> {
    if (!this.isConfigured()) {
      this.logger.warn(`Skipped SMS notification for user ${payload.userId}: SMS provider is not configured`);
      return this.result(0, 0, 1, "noop");
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

  private isConfigured(): boolean {
    if (!this.configService.get<boolean>("SMS_ENABLED", false)) {
      return false;
    }

    return ["SMS_API_URL", "SMS_API_KEY", "SMS_SENDER_ID"].every((key) => this.hasConfigValue(key));
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
    mode: "noop" | "active"
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