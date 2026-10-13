import { getApiErrorMessage } from "@/lib/api-client";

export type TenantMembershipSummary = {
  tenantId: string;
  tenantName?: string | null;
  isActive?: boolean;
  membershipActive?: boolean;
};

type SessionClient = {
  get: (url: string) => Promise<{ data?: { data?: unknown } }>;
};

export type TenantSessionLoadResult =
  | { kind: "ready"; profile: unknown; memberships: TenantMembershipSummary[]; tenantId: string }
  | { kind: "no_membership"; profile: unknown; memberships: TenantMembershipSummary[] }
  | { kind: "selection_required"; profile: unknown; memberships: TenantMembershipSummary[] }
  | { kind: "session_expired" }
  | { kind: "access_denied"; message: string }
  | { kind: "error"; message: string };

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function codeOf(error: unknown): string {
  return String(
    (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code ?? ""
  ).toUpperCase();
}

export function normalizeMemberships(payload: unknown): TenantMembershipSummary[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const root = payload as {
    memberships?: unknown;
    tenants?: unknown;
    items?: unknown;
  };
  const list = (root.memberships ?? root.tenants ?? root.items ?? payload) as unknown;
  if (!Array.isArray(list)) {
    return [];
  }

  const out: TenantMembershipSummary[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const tenantFromNested =
      row.tenant && typeof row.tenant === "object"
        ? (row.tenant as { id?: string; name?: string; isActive?: boolean })
        : null;
    const tenantId =
      (typeof row.tenantId === "string" && row.tenantId) ||
      (typeof row.id === "string" && row.id) ||
      (typeof tenantFromNested?.id === "string" ? tenantFromNested.id : null);
    if (!tenantId) continue;

    out.push({
      tenantId,
      tenantName:
        (typeof row.tenantName === "string" && row.tenantName) ||
        (typeof tenantFromNested?.name === "string" ? tenantFromNested.name : null),
      isActive: row.isActive !== false && tenantFromNested?.isActive !== false,
      membershipActive:
        row.membershipActive !== false && row.active !== false && row.status !== "DISABLED"
    });
  }
  return out;
}

/**
 * `/auth/me` and `/tenants/me` both depend only on the session cookie.
 * They run together so a full document load waits for the slower call, not the sum.
 * A failed session check still blocks tenant selection.
 */
export async function loadTenantSession(
  client: SessionClient,
  preferredTenantId: string | null
): Promise<TenantSessionLoadResult> {
  const [meOutcome, tenantOutcome] = await Promise.allSettled([
    client.get("/auth/me"),
    client.get("/tenants/me")
  ]);

  if (meOutcome.status === "rejected") {
    if (statusOf(meOutcome.reason) === 401) {
      return { kind: "session_expired" };
    }
    return { kind: "error", message: getApiErrorMessage(meOutcome.reason, "Unable to verify session") };
  }

  const profile = meOutcome.value.data?.data;

  if (tenantOutcome.status === "rejected") {
    const error = tenantOutcome.reason;
    const status = statusOf(error);
    const code = codeOf(error);
    if (status === 403 || code.includes("TENANT") || code.includes("MEMBERSHIP")) {
      return { kind: "access_denied", message: getApiErrorMessage(error, "Tenant access denied") };
    }
    return { kind: "error", message: getApiErrorMessage(error, "Unable to load tenant memberships") };
  }

  const memberships = normalizeMemberships(tenantOutcome.value.data?.data).filter(
    (item) => item.isActive !== false && item.membershipActive !== false
  );

  if (memberships.length === 0) {
    return { kind: "no_membership", profile, memberships };
  }

  const preferredValid = preferredTenantId
    ? memberships.find((item) => item.tenantId === preferredTenantId)
    : null;
  if (preferredValid) {
    return { kind: "ready", profile, memberships, tenantId: preferredValid.tenantId };
  }
  if (memberships.length === 1) {
    return { kind: "ready", profile, memberships, tenantId: memberships[0].tenantId };
  }
  return { kind: "selection_required", profile, memberships };
}
