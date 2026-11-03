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
    const safe = safeNotificationPath(supplied);
    if (safe) return retiredGateTarget(safe) ?? safe;
  }

  const id = input.referenceId?.trim();
  const type = input.type ?? "";
  const title = input.title ?? "";
  if (input.referenceType === "WorkOrder" && id) {
    if (type === "LOW_STOCK") return `/work-orders?wo=${id}&tab=parts`;
    if (/verif/i.test(title) || /verif/i.test(type)) return `/work-orders?wo=${id}&tab=evidence`;
    return `/work-orders?wo=${id}`;
  }
  // Gate notifications also open the vehicle record (the gate screen was retired from the UI).
  if (input.referenceType === "Vehicle" && id) return `/vehicles/${id}`;
  if (type === "MAINTENANCE_DUE") return id ? `/maintenance/plans?q=${encodeURIComponent(id)}` : "/maintenance/plans?due=overdue";
  if (type === "LOW_STOCK" && id) return `/inventory?q=${encodeURIComponent(id)}`;
  if (input.referenceType === "FacilityIssue" && id) return `/cleaning/issues?issueId=${id}`;
  if (input.referenceType === "MaintenanceRequest" && id) return `/requests/${id}`;
  if (input.referenceType === "WorkPermit") return "/admin/work-permits";
  return "/notifications";
}

/**
 * The gate screen was retired from the UI. Older notifications (and API deep links) that
 * still point at /fleet/gate open the vehicle record, or the fleet list without a vehicle.
 */
export function retiredGateTarget(path: string): string | null {
  const [pathname, query = ""] = path.split("?");
  if (pathname !== "/fleet/gate" && !pathname.startsWith("/fleet/gate/")) return null;
  const vehicle = new URLSearchParams(query).get("vehicle")?.trim();
  return vehicle && /^[A-Za-z0-9_-]+$/.test(vehicle) ? `/vehicles/${vehicle}` : "/fleet";
}

/** In-app paths only. Absolute, protocol-relative, and script URLs are not notification targets. */
export function safeNotificationPath(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.includes("://") || /[\s\\]/.test(value)) return null;
  if (value === "/notifications" || value.startsWith("/notifications?")) return null;
  return value;
}

/** True when Open context leaves the inbox for a business record. */
export function notificationContextIsLinked(href: string | null | undefined): boolean {
  if (!href?.trim()) return false;
  if (!safeNotificationPath(href)) return false;
  try {
    return new URL(href, "http://maintainpro.local").pathname !== "/notifications";
  } catch {
    return false;
  }
}

export function notificationNextAction(input: {
  type?: string | null;
  title?: string | null;
  referenceType?: string | null;
}): string {
  const type = input.type ?? "";
  const title = input.title ?? "";
  if (/gate/i.test(title) || /gate/i.test(type)) return "Open vehicle";
  if (/verif/i.test(title) || /verif/i.test(type)) return "Open job supervisor check";
  if (type === "LOW_STOCK") return "Open parts";
  if (type === "MAINTENANCE_DUE" || input.referenceType === "MaintenancePlan") return "Open scheduled service plan";
  if (input.referenceType === "WorkOrder" || type.startsWith("WORK_ORDER")) return "Open job";
  if (input.referenceType === "Vehicle") return "Open vehicle";
  if (input.referenceType === "FacilityIssue" || input.referenceType === "MaintenanceRequest") return "Open request";
  if (input.referenceType === "WorkPermit") return "Open work permits";
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
