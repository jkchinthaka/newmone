import type { Page } from "@playwright/test";
import { e2eRunId } from "./env";
import { authenticatedGet, getAuthenticatedUserId } from "./browser-session";

export type WorkOrderCreatePayload = {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: "CORRECTIVE" | "PREVENTIVE" | "EMERGENCY" | "INSPECTION" | "INSTALLATION";
  createdById: string;
  assetId?: string;
  vehicleId?: string;
  functionalLocationId?: string;
};

/**
 * Resolve a maintainable target for create validation (asset / vehicle / FL).
 * Prefer seeded E2E assets; never logs identifiers.
 */
async function resolveDefaultAssetId(page: Page): Promise<string | undefined> {
  const runId = e2eRunId();
  const preferredTag = `E2E-ASSET-${runId}`;
  const response = await authenticatedGet(
    page,
    `/api/backend/assets?page=1&pageSize=20&search=${encodeURIComponent(preferredTag)}`
  );
  if (response.status() !== 200) {
    return undefined;
  }
  const body = (await response.json()) as {
    data?: Array<{ id?: string; assetTag?: string }> | { items?: Array<{ id?: string; assetTag?: string }> };
  };
  const rows = Array.isArray(body.data)
    ? body.data
    : Array.isArray(body.data?.items)
      ? body.data.items
      : [];
  const preferred = rows.find((row) => row.assetTag === preferredTag && row.id);
  if (preferred?.id) return preferred.id;
  const first = rows.find((row) => row.id);
  return first?.id;
}

/**
 * Build a valid CORRECTIVE work-order create payload for the current browser session.
 * Resolves createdById from authenticated `/auth/me` — never hardcodes seeded ObjectIds.
 * Attaches a seeded asset when the API requires asset/vehicle/functional location.
 * Does not log user IDs or the complete payload.
 */
export async function buildValidWorkOrderPayload(
  page: Page,
  overrides?: Partial<Omit<WorkOrderCreatePayload, "createdById">> & {
    createdById?: string;
  }
): Promise<WorkOrderCreatePayload> {
  const createdById = overrides?.createdById ?? (await getAuthenticatedUserId(page));
  const runFragment = e2eRunId().slice(-12);
  const title =
    overrides?.title ??
    `E2E CSRF WO ${runFragment}`;

  const assetId =
    overrides?.assetId ??
    (overrides?.vehicleId || overrides?.functionalLocationId
      ? undefined
      : await resolveDefaultAssetId(page));

  if (!assetId && !overrides?.vehicleId && !overrides?.functionalLocationId) {
    throw new Error(
      "E2E work-order payload requires a seeded asset, vehicle, or functional location."
    );
  }

  return {
    title,
    description: overrides?.description ?? "Created with CSRF via browser session",
    priority: overrides?.priority ?? "MEDIUM",
    type: overrides?.type ?? "CORRECTIVE",
    createdById,
    ...(assetId ? { assetId } : {}),
    ...(overrides?.vehicleId ? { vehicleId: overrides.vehicleId } : {}),
    ...(overrides?.functionalLocationId
      ? { functionalLocationId: overrides.functionalLocationId }
      : {})
  };
}

export function assertNoAccessTokensInBody(body: unknown): void {
  const serialized = JSON.stringify(body);
  if (/"accessToken"\s*:/.test(serialized) || /"refreshToken"\s*:/.test(serialized)) {
    throw new Error("Response unexpectedly included auth token fields.");
  }
}
