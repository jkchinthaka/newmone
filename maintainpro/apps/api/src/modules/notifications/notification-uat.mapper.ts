export const NOTIFICATION_UAT_TEMPLATE_KEYS = [
  "critical_facility_issue",
  "work_order_from_issue",
  "overdue_sla_alert",
  "invitation_created"
] as const;

export type NotificationUatTemplateKey = (typeof NOTIFICATION_UAT_TEMPLATE_KEYS)[number];

export type NotificationUatSendStatus =
  | "blocked"
  | "not_configured"
  | "misconfigured"
  | "rejected"
  | "sent"
  | "mock";

export type NotificationUatSendResult = {
  channel: "email" | "sms";
  status: NotificationUatSendStatus;
  provider: string;
  templateKey: string;
  recipientMasked: string;
  messageId: string | null;
  sentAt: string | null;
  message: string;
};

export type NotificationUatControlsSummary = {
  uatEnabled: boolean;
  realSendsEnabled: boolean;
  allowlistCount: number;
  message: string;
};

const PUBLIC_UAT_SEND_RESULT_KEYS = new Set<string>([
  "channel",
  "status",
  "provider",
  "templateKey",
  "recipientMasked",
  "messageId",
  "sentAt",
  "message"
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export function parseNotificationUatAllowlist(raw: string | undefined | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function normalizeUatEmailRecipient(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeUatPhoneRecipient(value: string): string {
  return value.trim().replace(/[\s()-]/g, "");
}

export function isValidUatEmailRecipient(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeUatEmailRecipient(value));
}

export function isValidUatPhoneRecipient(value: string): boolean {
  return PHONE_PATTERN.test(normalizeUatPhoneRecipient(value));
}

export function isRecipientAllowlisted(
  recipient: string,
  allowlist: string[],
  channel: "email" | "sms"
): boolean {
  if (allowlist.length === 0) {
    return false;
  }

  const normalizedRecipient =
    channel === "email" ? normalizeUatEmailRecipient(recipient) : normalizeUatPhoneRecipient(recipient);

  return allowlist.some((entry) => {
    const normalizedEntry =
      channel === "email" ? normalizeUatEmailRecipient(entry) : normalizeUatPhoneRecipient(entry);
    return normalizedEntry === normalizedRecipient;
  });
}

export function maskEmailRecipient(email: string): string {
  const normalized = normalizeUatEmailRecipient(email);
  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain) {
    return "***";
  }

  const visible = localPart.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function maskPhoneRecipient(phone: string): string {
  const normalized = normalizeUatPhoneRecipient(phone);
  if (normalized.length <= 4) {
    return "***";
  }

  return `${normalized.slice(0, Math.min(4, normalized.length))}****${normalized.slice(-3)}`;
}

export function maskUatRecipient(recipient: string, channel: "email" | "sms"): string {
  return channel === "email" ? maskEmailRecipient(recipient) : maskPhoneRecipient(recipient);
}

export function describeNotificationUatControls(input: {
  uatEnabled: boolean;
  realSendsEnabled: boolean;
  allowlist: string[];
}): NotificationUatControlsSummary {
  if (!input.uatEnabled) {
    return {
      uatEnabled: false,
      realSendsEnabled: input.realSendsEnabled,
      allowlistCount: input.allowlist.length,
      message: "Notification UAT is disabled. Set NOTIFICATION_UAT_ENABLED=true to enable staged test sends."
    };
  }

  if (!input.realSendsEnabled) {
    return {
      uatEnabled: true,
      realSendsEnabled: false,
      allowlistCount: input.allowlist.length,
      message:
        "UAT workflow is enabled but real sends are disabled. Set NOTIFICATION_REAL_SENDS_ENABLED=true after credentials are approved."
    };
  }

  if (input.allowlist.length === 0) {
    return {
      uatEnabled: true,
      realSendsEnabled: true,
      allowlistCount: 0,
      message: "Real sends are enabled but NOTIFICATION_UAT_ALLOWED_RECIPIENTS is empty."
    };
  }

  return {
    uatEnabled: true,
    realSendsEnabled: true,
    allowlistCount: input.allowlist.length,
    message: "Staged UAT sends are enabled for allowlisted recipients only."
  };
}

export function isNotificationUatTemplateKey(value: string): value is NotificationUatTemplateKey {
  return (NOTIFICATION_UAT_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function publicNotificationUatSendResultHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !PUBLIC_UAT_SEND_RESULT_KEYS.has(key))) {
    return true;
  }

  const serialized = JSON.stringify(record);
  return /smtp_pass|sms_api_key|api[_-]?key|authorization|secret|token/i.test(serialized);
}
