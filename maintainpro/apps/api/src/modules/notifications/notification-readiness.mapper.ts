import type { NotificationReadinessState } from "./notification-readiness.service";

export type EmailIndicator = "EMAIL_ENABLED" | "EMAIL_DISABLED" | "EMAIL_MISCONFIGURED";
export type SmsIndicator = "SMS_ENABLED" | "SMS_DISABLED" | "SMS_MISCONFIGURED";
export type PushIndicator = "PUSH_ENABLED" | "PUSH_DISABLED" | "PUSH_NOOP";

export function mapEmailIndicator(input: {
  state: NotificationReadinessState;
  mode: string;
}): EmailIndicator {
  if (input.state === "configured" && input.mode === "live") {
    return "EMAIL_ENABLED";
  }

  if (input.state === "disabled") {
    return "EMAIL_DISABLED";
  }

  return "EMAIL_MISCONFIGURED";
}

export function mapSmsIndicator(input: {
  state: NotificationReadinessState;
  mode: string;
}): SmsIndicator {
  if (input.state === "configured" && input.mode === "live") {
    return "SMS_ENABLED";
  }

  if (input.state === "disabled" || input.mode === "mock") {
    return "SMS_DISABLED";
  }

  return "SMS_MISCONFIGURED";
}

export function mapPushIndicator(input: {
  mode: "disabled" | "mock" | "active" | "misconfigured";
  configured: boolean;
}): PushIndicator {
  if (input.mode === "active" && input.configured) {
    return "PUSH_ENABLED";
  }

  if (input.mode === "mock") {
    return "PUSH_NOOP";
  }

  return "PUSH_DISABLED";
}

const PUBLIC_NOTIFICATION_READINESS_KEYS = new Set<string>([
  "generatedAt",
  "overallState",
  "email",
  "sms",
  "push",
  "uat"
]);

const PUBLIC_CHANNEL_KEYS = new Set<string>([
  "channel",
  "state",
  "mode",
  "message",
  "missingKeys",
  "indicator"
]);

export function publicNotificationReadinessHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !PUBLIC_NOTIFICATION_READINESS_KEYS.has(key))) {
    return true;
  }

  for (const channelKey of ["email", "sms", "push"] as const) {
    const channel = record[channelKey];
    if (channel && typeof channel === "object" && !Array.isArray(channel)) {
      const channelRecord = channel as Record<string, unknown>;
      if (Object.keys(channelRecord).some((key) => !PUBLIC_CHANNEL_KEYS.has(key))) {
        return true;
      }
    }
  }

  const serialized = JSON.stringify(record);
  return /smtp_pass|sms_api_key|push_provider_api_key|bearer\s+[a-z0-9+/=]{8,}/i.test(serialized);
}
