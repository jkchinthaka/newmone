import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EmailDispatchService } from "./email-dispatch.service";
import { SmsDispatchService } from "./sms-dispatch.service";

export type NotificationReadinessState =
  | "disabled"
  | "not_configured"
  | "misconfigured"
  | "configured";

export type NotificationChannelReadiness = {
  channel: "email" | "sms";
  state: NotificationReadinessState;
  mode: string;
  message: string;
  missingKeys: string[];
};

export type NotificationReadinessSummary = {
  generatedAt: string;
  overallState: NotificationReadinessState;
  email: NotificationChannelReadiness;
  sms: NotificationChannelReadiness;
};

const EMAIL_LIVE_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;
const SMS_LIVE_KEYS = ["SMS_API_URL", "SMS_API_KEY", "SMS_SENDER_ID"] as const;

@Injectable()
export class NotificationReadinessService {
  constructor(
    private readonly configService: ConfigService,
    private readonly emailDispatchService: EmailDispatchService,
    private readonly smsDispatchService: SmsDispatchService
  ) {}

  getSummary(): NotificationReadinessSummary {
    const email = this.describeEmailReadiness();
    const sms = this.describeSmsReadiness();

    return {
      generatedAt: new Date().toISOString(),
      overallState: this.resolveOverallState([email.state, sms.state]),
      email,
      sms
    };
  }

  private describeEmailReadiness(): NotificationChannelReadiness {
    const mode = this.configService.get<string>("EMAIL_MODE", "disabled").trim().toLowerCase();
    if (mode === "disabled") {
      return {
        channel: "email",
        state: "disabled",
        mode,
        message: "Email delivery is disabled by EMAIL_MODE=disabled",
        missingKeys: []
      };
    }

    const missingKeys = this.missingKeys(EMAIL_LIVE_KEYS);
    if (missingKeys.length === EMAIL_LIVE_KEYS.length) {
      return {
        channel: "email",
        state: "not_configured",
        mode,
        message: "EMAIL_MODE=live but no SMTP settings are present",
        missingKeys
      };
    }

    if (missingKeys.length > 0) {
      return {
        channel: "email",
        state: "misconfigured",
        mode,
        message: "EMAIL_MODE=live but required SMTP settings are incomplete",
        missingKeys
      };
    }

    const provider = this.emailDispatchService.describeProvider();
    return {
      channel: "email",
      state: provider.configured ? "configured" : "misconfigured",
      mode,
      message: provider.description,
      missingKeys: provider.configured ? [] : missingKeys
    };
  }

  private describeSmsReadiness(): NotificationChannelReadiness {
    const mode = this.configService.get<string>("SMS_MODE", "disabled").trim().toLowerCase();
    if (mode === "disabled") {
      return {
        channel: "sms",
        state: "disabled",
        mode,
        message: "SMS delivery is disabled by SMS_MODE=disabled",
        missingKeys: []
      };
    }

    if (mode === "mock") {
      const provider = this.smsDispatchService.describeProvider();
      if (provider.mode === "misconfigured") {
        return {
          channel: "sms",
          state: "misconfigured",
          mode,
          message: provider.description,
          missingKeys: []
        };
      }

      return {
        channel: "sms",
        state: "configured",
        mode,
        message: provider.description,
        missingKeys: []
      };
    }

    const missingKeys = this.missingKeys(SMS_LIVE_KEYS);
    if (missingKeys.length === SMS_LIVE_KEYS.length) {
      return {
        channel: "sms",
        state: "not_configured",
        mode,
        message: "SMS_MODE=live but no SMS provider settings are present",
        missingKeys
      };
    }

    if (missingKeys.length > 0) {
      return {
        channel: "sms",
        state: "misconfigured",
        mode,
        message: "SMS_MODE=live but required SMS settings are incomplete",
        missingKeys
      };
    }

    const provider = this.smsDispatchService.describeProvider();
    return {
      channel: "sms",
      state: provider.configured ? "configured" : "misconfigured",
      mode,
      message: provider.description,
      missingKeys: provider.configured ? [] : missingKeys
    };
  }

  private missingKeys(keys: readonly string[]): string[] {
    return keys.filter((key) => !this.hasConfigValue(key));
  }

  private hasConfigValue(key: string): boolean {
    const value = this.configService.get<string | number | boolean | undefined>(key);
    return value !== undefined && String(value).trim().length > 0;
  }

  private resolveOverallState(states: NotificationReadinessState[]): NotificationReadinessState {
    if (states.every((state) => state === "disabled")) {
      return "disabled";
    }

    if (states.some((state) => state === "misconfigured")) {
      return "misconfigured";
    }

    if (states.some((state) => state === "not_configured")) {
      return "not_configured";
    }

    if (states.some((state) => state === "configured")) {
      return "configured";
    }

    return "disabled";
  }
}
