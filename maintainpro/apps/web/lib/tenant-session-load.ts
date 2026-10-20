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

function profileRole(profile: unknown): string {
  if (!profile || typeof profile !== "object") return "";
  const row = profile as { role?: unknown; roleName?: unknown };
  if (typeof row.roleName === "string") return row.roleName;
  if (typeof row.role === "string") return row.role;
  if (row.role && typeof row.role === "object") {
    const name = (row.role as { name?: unknown }).name;
    if (typeof name === "string") return name;
  }
  return "";
}

function profileTenantId(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const tenantId = (profile as { tenantId?: unknown }).tenantId;
  return typeof tenantId === "string" && tenantId.trim() ? tenantId : null;
}

/** REQUESTER has no tenant-list permission. Their tenant comes from `/auth/me`. */
export function shouldFetchTenantMemberships(profile: unknown): boolean {
  return profileRole(profile) !== "REQUESTER";
}

/** A stored tenant is stale unless it is exactly the home tenant from `/auth/me`. */
export function staleTenantSelection(storedTenantId: string | null, homeTenantId: string | null): boolean {
  return Boolean(storedTenantId) && storedTenantId !== homeTenantId;
}

/**
 * `/auth/me` is loaded first. `/tenants/me` runs only when the profile may list
 * memberships. REQUESTER skips that call so a 403 does not fire on every page.
 * The active tenant is the home tenant from `/auth/me`. When that id is missing,
 * the first active membership is used. An empty membership list is `no_membership`.
 * A stored selection is ignored. There is no tenant-picker state.
 */
export async function loadTenantSession(
  client: SessionClient,
  storedTenantId: string | null
): Promise<TenantSessionLoadResult> {
  let meOutcome: PromiseSettledResult<{ data?: { data?: unknown } }>;
  try {
    meOutcome = { status: "fulfilled", value: await client.get("/auth/me") };
  } catch (error) {
    meOutcome = { status: "rejected", reason: error };
  }

  if (meOutcome.status === "rejected") {
    if (statusOf(meOutcome.reason) === 401) {
      return { kind: "session_expired" };
    }
    return { kind: "error", message: getApiErrorMessage(meOutcome.reason, "Unable to verify session") };
  }

  const profile = meOutcome.value.data?.data;
  const homeTenantId = profileTenantId(profile);
  void storedTenantId;

  if (!shouldFetchTenantMemberships(profile)) {
    const tenantId = profileTenantId(profile);
    if (!tenantId) {
      return { kind: "no_membership", profile, memberships: [] };
    }
    return {
      kind: "ready",
      profile,
      memberships: [{ tenantId, isActive: true, membershipActive: true }],
      tenantId
    };
  }

  let tenantOutcome: PromiseSettledResult<{ data?: { data?: unknown } }>;
  try {
    tenantOutcome = { status: "fulfilled", value: await client.get("/tenants/me") };
  } catch (error) {
    tenantOutcome = { status: "rejected", reason: error };
  }

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

  return {
    kind: "ready",
    profile,
    memberships,
    tenantId: homeTenantId ?? memberships[0].tenantId
  };
}
