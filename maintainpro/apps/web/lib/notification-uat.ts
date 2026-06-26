export type NotificationReadinessState = "disabled" | "not_configured" | "misconfigured" | "configured";

export type NotificationChannelReadiness = {
  channel: "email" | "sms" | "push";
  state: NotificationReadinessState;
  mode: string;
  indicator: string;
  message: string;
  missingKeys: string[];
};

export type NotificationUatControlsSummary = {
  uatEnabled: boolean;
  realSendsEnabled: boolean;
  allowlistCount: number;
  message: string;
};

export type NotificationReadinessSummary = {
  generatedAt: string;
  overallState: NotificationReadinessState;
  email: NotificationChannelReadiness;
  sms: NotificationChannelReadiness;
  push?: NotificationChannelReadiness;
  uat: NotificationUatControlsSummary;
};

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

export const NOTIFICATION_UAT_TEMPLATE_OPTIONS = [
  { value: "critical_facility_issue", label: "Critical facility issue" },
  { value: "work_order_from_issue", label: "Work order from issue" },
  { value: "overdue_sla_alert", label: "Overdue SLA alert" },
  { value: "invitation_created", label: "Invitation created" }
] as const;

export function canAccessNotificationUat(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function notificationUatStatusTone(
  status: NotificationUatSendStatus | NotificationReadinessState
): "success" | "warning" | "danger" | "info" {
  if (status === "sent" || status === "configured") {
    return "success";
  }

  if (status === "mock" || status === "disabled" || status === "not_configured") {
    return "info";
  }

  if (status === "blocked" || status === "rejected") {
    return "warning";
  }

  return "danger";
}

export function formatNotificationUatResultSummary(result: NotificationUatSendResult): string {
  return `${result.channel.toUpperCase()} ${result.status}: ${result.message}`;
}

export function notificationUatRecipientPlaceholder(channel: "email" | "sms"): string {
  return channel === "email" ? "uat@example.com" : "+94771234567";
}

export function notificationUatDoesNotPersistRecipient(): boolean {
  return true;
}
