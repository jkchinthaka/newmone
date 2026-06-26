import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EmailDispatchService } from "./email-dispatch.service";
import {
  mapEmailIndicator,
  mapPushIndicator,
  mapSmsIndicator,
  type EmailIndicator,
  type PushIndicator,
  type SmsIndicator
} from "./notification-readiness.mapper";
import { describeNotificationUatControls, parseNotificationUatAllowlist } from "./notification-uat.mapper";
import { PushDispatchService } from "./push-dispatch.service";
import { SmsDispatchService } from "./sms-dispatch.service";

export type NotificationReadinessState =
  | "disabled"
  | "not_configured"
  | "misconfigured"
  | "configured";

export type NotificationChannelReadiness = {
  channel: "email" | "sms" | "push";
  state: NotificationReadinessState;
  mode: string;
  indicator: EmailIndicator | SmsIndicator | PushIndicator;
  message: string;
  missingKeys: string[];
};

export type NotificationReadinessSummary = {
  generatedAt: string;
  overallState: NotificationReadinessState;
  email: NotificationChannelReadiness;
  sms: NotificationChannelReadiness;
  push: NotificationChannelReadiness;
  uat: ReturnType<typeof describeNotificationUatControls>;
};

const EMAIL_LIVE_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;
const SMS_LIVE_KEYS = ["SMS_API_URL", "SMS_API_KEY", "SMS_SENDER_ID"] as const;

@Injectable()
export class NotificationReadinessService {
  constructor(
    private readonly configService: ConfigService,
    private readonly emailDispatchService: EmailDispatchService,
    private readonly smsDispatchService: SmsDispatchService,
    private readonly pushDispatchService: PushDispatchService
  ) {}

  getSummary(): NotificationReadinessSummary {
    const email = this.describeEmailReadiness();
    const sms = this.describeSmsReadiness();
    const push = this.describePushReadiness();
    const uat = describeNotificationUatControls({
      uatEnabled: this.configService.get<boolean>("NOTIFICATION_UAT_ENABLED", false),
      realSendsEnabled: this.configService.get<boolean>("NOTIFICATION_REAL_SENDS_ENABLED", false),
      allowlist: parseNotificationUatAllowlist(
        this.configService.get<string>("NOTIFICATION_UAT_ALLOWED_RECIPIENTS", "")
      )
    });

    return {
      generatedAt: new Date().toISOString(),
      overallState: this.resolveOverallState([email.state, sms.state, push.state]),
      email,
      sms,
      push,
      uat
    };
  }

  private describeEmailReadiness(): NotificationChannelReadiness {
    const mode = this.configService.get<string>("EMAIL_MODE", "disabled").trim().toLowerCase();
    if (mode === "disabled") {
      const state = "disabled" as const;
      return {
        channel: "email",
        state,
        mode,
        indicator: mapEmailIndicator({ state, mode }),
        message: "Email delivery is disabled by EMAIL_MODE=disabled",
        missingKeys: []
      };
    }

    const missingKeys = this.missingKeys(EMAIL_LIVE_KEYS);
    if (missingKeys.length === EMAIL_LIVE_KEYS.length) {
      const state = "not_configured" as const;
      return {
        channel: "email",
        state,
        mode,
        indicator: mapEmailIndicator({ state, mode }),
        message: "EMAIL_MODE=live but no SMTP settings are present",
        missingKeys
      };
    }

    if (missingKeys.length > 0) {
      const state = "misconfigured" as const;
      return {
        channel: "email",
        state,
        mode,
        indicator: mapEmailIndicator({ state, mode }),
        message: "EMAIL_MODE=live but required SMTP settings are incomplete",
        missingKeys
      };
    }

    const provider = this.emailDispatchService.describeProvider();
    const state = provider.configured ? "configured" : "misconfigured";
    return {
      channel: "email",
      state,
      mode,
      indicator: mapEmailIndicator({ state, mode }),
      message: provider.description,
      missingKeys: provider.configured ? [] : missingKeys
    };
  }

  private describeSmsReadiness(): NotificationChannelReadiness {
    const mode = this.configService.get<string>("SMS_MODE", "disabled").trim().toLowerCase();
    if (mode === "disabled") {
      const state = "disabled" as const;
      return {
        channel: "sms",
        state,
        mode,
        indicator: mapSmsIndicator({ state, mode }),
        message: "SMS delivery is disabled by SMS_MODE=disabled",
        missingKeys: []
      };
    }

    if (mode === "mock") {
      const provider = this.smsDispatchService.describeProvider();
      if (provider.mode === "misconfigured") {
        const state = "misconfigured" as const;
        return {
          channel: "sms",
          state,
          mode,
          indicator: mapSmsIndicator({ state, mode }),
          message: provider.description,
          missingKeys: []
        };
      }

      const state = "configured" as const;
      return {
        channel: "sms",
        state,
        mode,
        indicator: mapSmsIndicator({ state, mode }),
        message: provider.description,
        missingKeys: []
      };
    }

    const missingKeys = this.missingKeys(SMS_LIVE_KEYS);
    if (missingKeys.length === SMS_LIVE_KEYS.length) {
      const state = "not_configured" as const;
      return {
        channel: "sms",
        state,
        mode,
        indicator: mapSmsIndicator({ state, mode }),
        message: "SMS_MODE=live but no SMS provider settings are present",
        missingKeys
      };
    }

    if (missingKeys.length > 0) {
      const state = "misconfigured" as const;
      return {
        channel: "sms",
        state,
        mode,
        indicator: mapSmsIndicator({ state, mode }),
        message: "SMS_MODE=live but required SMS settings are incomplete",
        missingKeys
      };
    }

    const provider = this.smsDispatchService.describeProvider();
    const state = provider.configured ? "configured" : "misconfigured";
    return {
      channel: "sms",
      state,
      mode,
      indicator: mapSmsIndicator({ state, mode }),
      message: provider.description,
      missingKeys: provider.configured ? [] : missingKeys
    };
  }

  private describePushReadiness(): NotificationChannelReadiness {
    const mode = this.configService.get<string>("PUSH_MODE", "disabled").trim().toLowerCase();
    const providers = this.pushDispatchService.describeProviders();
    const primary = providers[0] ?? {
      id: "push-unknown",
      configured: false,
      mode: "disabled" as const,
      description: "Push provider summary unavailable"
    };

    let state: NotificationReadinessState = "disabled";
    if (primary.mode === "active" && primary.configured) {
      state = "configured";
    } else if (primary.mode === "mock") {
      state = "configured";
    } else if (primary.mode === "misconfigured") {
      state = "misconfigured";
    } else if (mode !== "disabled") {
      state = "not_configured";
    }

    return {
      channel: "push",
      state,
      mode,
      indicator: mapPushIndicator({ mode: primary.mode, configured: primary.configured }),
      message: primary.description,
      missingKeys: []
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
