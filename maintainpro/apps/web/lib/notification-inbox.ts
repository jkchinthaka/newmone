export type InboxUrlState = {
  q: string;
  status: "" | "UNREAD" | "READ";
  priority: string;
  type: string;
  module: string;
  ack: "" | "yes" | "no";
  overdue: boolean;
  from: string;
  to: string;
  page: number;
  pageSize: 20 | 50 | 100;
};

export function inboxStateFromSearch(params: URLSearchParams): InboxUrlState {
  const status = params.get("status");
  const pageSizeRaw = Number(params.get("pageSize") ?? "20");
  const ack = params.get("ack");
  return {
    q: params.get("q") ?? "",
    status: status === "UNREAD" || status === "READ" ? status : "",
    priority: params.get("priority") ?? "",
    type: params.get("type") ?? "",
    module: params.get("module") ?? "",
    ack: ack === "yes" || ack === "no" ? ack : "",
    overdue: params.get("overdue") === "1",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    page: Math.max(Number(params.get("page") ?? "1") || 1, 1),
    pageSize: pageSizeRaw === 50 || pageSizeRaw === 100 ? pageSizeRaw : 20
  };
}

export function inboxSearchParams(state: InboxUrlState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.status) params.set("status", state.status);
  if (state.priority) params.set("priority", state.priority);
  if (state.type) params.set("type", state.type);
  if (state.module) params.set("module", state.module);
  if (state.ack) params.set("ack", state.ack);
  if (state.overdue) params.set("overdue", "1");
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 20) params.set("pageSize", String(state.pageSize));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function notificationContextHref(input: {
  type?: string | null;
  title?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  deepLink?: string | null;
}): string {
  const supplied = input.deepLink?.trim();
  if (supplied && supplied !== "/notifications") {
    const highlight = supplied.match(/[?&]highlight=([^&]+)/);
    if (highlight) return `/work-orders?wo=${decodeURIComponent(highlight[1])}`;
    return supplied;
  }

  const id = input.referenceId?.trim();
  const type = input.type ?? "";
  const title = input.title ?? "";
  if (input.referenceType === "WorkOrder" && id) {
    if (type === "LOW_STOCK") return `/work-orders?wo=${id}&tab=parts`;
    if (/verif/i.test(title) || /verif/i.test(type)) return `/work-orders?wo=${id}&tab=evidence`;
    return `/work-orders?wo=${id}`;
  }
  if (input.referenceType === "Vehicle" && id) {
    if (/gate/i.test(title) || /gate/i.test(type)) return `/fleet/gate?vehicle=${id}`;
    return `/vehicles/${id}`;
  }
  if (type === "MAINTENANCE_DUE") return id ? `/maintenance/plans?q=${encodeURIComponent(id)}` : "/maintenance/plans?due=overdue";
  if (type === "LOW_STOCK" && id) return `/inventory?q=${encodeURIComponent(id)}`;
  if (input.referenceType === "FacilityIssue" && id) return `/cleaning/issues?issueId=${id}`;
  return "/notifications";
}

export function notificationNextAction(input: {
  type?: string | null;
  title?: string | null;
  referenceType?: string | null;
}): string {
  const type = input.type ?? "";
  const title = input.title ?? "";
  if (/gate/i.test(title) || /gate/i.test(type)) return "Open vehicle gate";
  if (/verif/i.test(title) || /verif/i.test(type)) return "Open work order verification";
  if (type === "LOW_STOCK") return "Open parts";
  if (type === "MAINTENANCE_DUE" || input.referenceType === "MaintenancePlan") return "Open PM plan";
  if (input.referenceType === "WorkOrder" || type.startsWith("WORK_ORDER")) return "Open work order";
  if (input.referenceType === "Vehicle") return "Open vehicle";
  if (input.referenceType === "FacilityIssue") return "Open request";
  return "Open context";
}

export function notificationStateLabel(item: { isRead: boolean; acknowledgedAt?: string | null }) {
  if (item.acknowledgedAt) return "Acknowledged";
  if (item.isRead) return "Read";
  return "Unread";
}

export function visibleNotificationChannels(availability: {
  inApp?: boolean;
  email?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
  push?: boolean;
}) {
  return (["inApp", "email", "sms", "whatsapp", "push"] as const).filter((key) => availability[key] === true);
}

export function passwordChangeError(input: { current: string; next: string; confirm: string }) {
  if (!input.current.trim()) return "Enter your current password.";
  if (input.next.length < 8) return "New password must be at least 8 characters.";
  if (input.next !== input.confirm) return "New password and confirmation do not match.";
  return null;
}

export function settingsAdminShortcuts(role: string | null) {
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") return [];
  const links = [
    { href: "/admin", label: "Administration" },
    { href: "/admin/users", label: "Users & access" },
    { href: "/admin/roles", label: "Roles" },
    { href: "/admin/organization", label: "Organization" }
  ];
  if (role === "SUPER_ADMIN") {
    links.push({ href: "/system-health", label: "Technical administration" });
  }
  return links;
}

export const MUTED_NOTIFICATION_TYPES = [
  "MAINTENANCE_DUE",
  "WORK_ORDER_ASSIGNED",
  "WORK_ORDER_UPDATED",
  "LOW_STOCK",
  "VEHICLE_SERVICE_DUE",
  "LICENSE_EXPIRY",
  "INSURANCE_EXPIRY",
  "UTILITY_BILL_DUE",
  "SLA_BREACH_WARNING",
  "SYSTEM_ALERT",
  "PART_REQUEST_SUBMITTED",
  "PART_REQUEST_APPROVED",
  "PART_REQUEST_REJECTED",
  "PURCHASE_ORDER_APPROVED",
  "PURCHASE_ORDER_REJECTED"
] as const;
