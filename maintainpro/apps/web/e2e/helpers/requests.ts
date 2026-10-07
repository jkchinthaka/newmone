import { expect, type Page } from "@playwright/test";
import { qaTag } from "./env";
import {
  assertNoTokensInBody,
  authenticatedGet,
  authenticatedPost,
  unwrapData
} from "./session";
import { resolveAssetId } from "./work-orders";

export type MaintenanceRequestRecord = {
  id?: string;
  _id?: string;
  status?: string;
  description?: string;
  requestNumber?: string;
};

export function requestId(body: unknown): string {
  const row = unwrapData<MaintenanceRequestRecord>(body);
  return String(row.id || row._id || "").trim();
}

export async function createMaintenanceRequest(
  page: Page,
  overrides?: { description?: string; assetId?: string }
) {
  const description = overrides?.description ?? `${qaTag("REQ")} needs attention urgently`;
  const assetId = overrides?.assetId ?? (await resolveAssetId(page));
  const response = await authenticatedPost(page, "/api/backend/maintenance-requests", {
    data: {
      description,
      assetId,
      reportedUrgency: "NORMAL"
    }
  });
  const json = await response.json().catch(() => ({}));
  return {
    status: response.status(),
    id: requestId(json),
    description,
    json
  };
}

export async function fetchRequest(page: Page, id: string) {
  const response = await authenticatedGet(page, `/api/backend/maintenance-requests/${id}`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  assertNoTokensInBody(body);
  return unwrapData<MaintenanceRequestRecord>(body);
}

export async function startReview(page: Page, id: string) {
  return authenticatedPost(page, `/api/backend/maintenance-requests/${id}/start-review`, {
    data: {}
  });
}

export async function triageRequest(page: Page, id: string, data: Record<string, unknown> = {}) {
  return authenticatedPost(page, `/api/backend/maintenance-requests/${id}/triage`, {
    data: { priority: "MEDIUM", ...data }
  });
}

export async function approveRequest(page: Page, id: string) {
  return authenticatedPost(page, `/api/backend/maintenance-requests/${id}/approve`, {
    data: {}
  });
}

export async function convertRequestToWorkOrder(page: Page, id: string, title?: string) {
  const response = await authenticatedPost(
    page,
    `/api/backend/maintenance-requests/${id}/convert-to-work-order`,
    { data: title ? { title } : {} }
  );
  const json = await response.json().catch(() => ({}));
  return { status: response.status(), json };
}
