import type { Page } from "@playwright/test";
import { e2eRunId } from "./env";
import { getAuthenticatedUserId } from "./browser-session";

export type WorkOrderCreatePayload = {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: "CORRECTIVE" | "PREVENTIVE" | "EMERGENCY" | "INSPECTION" | "INSTALLATION";
  createdById: string;
  assetId?: string;
  vehicleId?: string;
};

/**
 * Build a valid CORRECTIVE work-order create payload for the current browser session.
 * Resolves createdById from authenticated `/auth/me` — never hardcodes seeded ObjectIds.
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

  return {
    title,
    description: overrides?.description ?? "Created with CSRF via browser session",
    priority: overrides?.priority ?? "MEDIUM",
    type: overrides?.type ?? "CORRECTIVE",
    createdById,
    ...(overrides?.assetId ? { assetId: overrides.assetId } : {}),
    ...(overrides?.vehicleId ? { vehicleId: overrides.vehicleId } : {})
  };
}

export function assertNoAccessTokensInBody(body: unknown): void {
  const serialized = JSON.stringify(body);
  if (/"accessToken"\s*:/.test(serialized) || /"refreshToken"\s*:/.test(serialized)) {
    throw new Error("Response unexpectedly included auth token fields.");
  }
}
