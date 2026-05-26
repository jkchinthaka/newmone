import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";

import { PrismaService } from "../../database/prisma.service";

type EmailDispatchPayload = {
  userId: string;
  title?: string;
  message: string;
  notificationId?: string;
};

type EmailDeliveryResult = {
  providerId: string;
  attempted: number;
  delivered: number;
  skipped: number;
  mode: "noop" | "active";
};

export type EmailProviderSummary = {
  id: string;
  configured: boolean;
  mode: "noop" | "active";
  description: string;
};

@Injectable()
export class EmailDispatchService {
  private readonly logger = new Logger(EmailDispatchService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  describeProvider(): EmailProviderSummary {
    const configured = this.isConfigured();
    return {
      id: "smtp",
      configured,
      mode: configured ? "active" : "noop",
      description: configured
        ? "SMTP email delivery is configured"
        : "SMTP email delivery is disabled or missing required SMTP settings"
    };
  }

  async dispatch(payload: EmailDispatchPayload): Promise<EmailDeliveryResult> {
    if (!this.isConfigured()) {
      this.logger.warn(`Skipped email notification for user ${payload.userId}: SMTP is not configured`);
      return this.result(0, 0, 1, "noop");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true, firstName: true, lastName: true }
    });

    if (!user?.email) {
      this.logger.warn(`Skipped email notification for user ${payload.userId}: recipient email is missing`);
      return this.result(0, 0, 1, "active");
    }

    const transport = nodemailer.createTransport({
      host: this.configService.get<string>("SMTP_HOST"),
      port: this.configService.get<number>("SMTP_PORT", 587),
      secure: this.configService.get<boolean>("SMTP_SECURE", false),
      auth: {
        user: this.configService.get<string>("SMTP_USER"),
        pass: this.configService.get<string>("SMTP_PASS")
      }
    });

    await transport.sendMail({
      from: this.configService.get<string>("SMTP_FROM"),
      to: user.email,
      subject: payload.title ?? "MaintainPro alert",
      text: payload.message,
      html: this.toHtml(payload.title ?? "MaintainPro alert", payload.message)
    });

    if (payload.notificationId) {
      await this.prisma.notification.update({
        where: { id: payload.notificationId },
        data: { sentAt: new Date() }
      });
    }

    this.logger.log(`Delivered email notification ${payload.notificationId ?? "(ad hoc)"} to ${user.email}`);
    return this.result(1, 1, 0, "active");
  }

  private isConfigured(): boolean {
    if (!this.configService.get<boolean>("SMTP_ENABLED", true)) {
      return false;
    }

    return ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"].every((key) =>
      this.hasConfigValue(key)
    );
  }

  private hasConfigValue(key: string): boolean {
    const value = this.configService.get<string | number | boolean | undefined>(key);
    return value !== undefined && String(value).trim().length > 0;
  }

  private toHtml(title: string, message: string): string {
    return `<h1>${this.escapeHtml(title)}</h1><p>${this.escapeHtml(message)}</p>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private result(
    attempted: number,
    delivered: number,
    skipped: number,
    mode: "noop" | "active"
  ): EmailDeliveryResult {
    return {
      providerId: "smtp",
      attempted,
      delivered,
      skipped,
      mode
    };
  }
}