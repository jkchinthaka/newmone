import { FG_BFF_PREFIX } from "./fg-config";
import { parseFgEnvelope, safeFgErrorMessage } from "./fg-mappers";
import type { FgEnvelope } from "./fg-types";

let sessionPromise: Promise<void> | null = null;

function csrfTokenFromDocument(): string {
  if (typeof document === "undefined") {
    return "";
  }
  const match = document.cookie.split("; ").find((row) => row.startsWith("csrftoken="));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : "";
}

async function fgRequest<T>(path: string, init?: RequestInit): Promise<FgEnvelope<T>> {
  const method = (init?.method || "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", headers.get("Content-Type") || "application/json");
    const csrf = csrfTokenFromDocument();
    if (csrf) {
      headers.set("X-CSRFToken", csrf);
    }
  }
  const response = await fetch(`${FG_BFF_PREFIX}/${path.replace(/^\//, "")}`, {
    ...init,
    method,
    headers,
    credentials: "include",
    cache: "no-store"
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const parsed = parseFgEnvelope<T>(payload);
  if (!parsed.error && !response.ok) {
    return {
      data: null,
      meta: null,
      error: {
        code: response.status === 401 ? "UNAUTHENTICATED" : "REQUEST_FAILED",
        message: safeFgErrorMessage(null),
        fieldErrors: {}
      }
    };
  }
  return parsed;
}

export async function ensureFgSession(): Promise<FgEnvelope<{ authenticated: boolean }>> {
  if (!sessionPromise) {
    sessionPromise = fgRequest("session")
      .then((result) => {
        if (result.error) {
          sessionPromise = null;
        }
      })
      .catch(() => {
        sessionPromise = null;
      });
  }
  await sessionPromise;
  return fgRequest("session");
}

export async function fetchFgDashboard(date?: string) {
  await ensureFgSession();
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return fgRequest<import("./fg-types").FgDashboard>(`dashboard${query}`);
}

export async function openFgRecord(
  formCode: string,
  date: string,
  options?: { room?: string; occurrenceToken?: string }
) {
  await ensureFgSession();
  const room = options?.room || "";
  const occurrenceToken = options?.occurrenceToken || "";
  return fgRequest<{ record: import("./fg-types").FgRecordSummary }>("records/open", {
    method: "POST",
    body: JSON.stringify({
      formCode,
      date,
      room,
      ...(occurrenceToken ? { occurrenceToken, occurrence_token: occurrenceToken } : {})
    })
  });
}

export async function fetchFgRecord(id: string) {
  await ensureFgSession();
  return fgRequest<import("./fg-types").FgRecordDetail>(`records/${id}`);
}

export async function saveFgRecord(
  id: string,
  payload: { expectedDraftVersion: number; fields: Record<string, string> }
) {
  await ensureFgSession();
  return fgRequest<{ draftVersion: number }>(`records/${id}/save`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function submitFgRecord(id: string, idempotencyKey: string) {
  await ensureFgSession();
  return fgRequest<{ submissionId: string }>(`records/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey })
  });
}

export async function fetchFgHistory(params: Record<string, string>) {
  await ensureFgSession();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return fgRequest<{ records: import("./fg-types").FgRecordSummary[]; forms: import("./fg-types").FgFormCard[] }>(
    `history?${query.toString()}`
  );
}

export async function fetchFgReviews() {
  await ensureFgSession();
  return fgRequest<{ submissions: import("./fg-types").FgSubmissionRow[] }>("reviews");
}

export async function fetchFgReview(id: string) {
  await ensureFgSession();
  return fgRequest<Record<string, unknown>>(`reviews/${id}`);
}

export async function decideFgReview(
  id: string,
  payload: { decision: string; reviewNote: string; idempotencyKey: string }
) {
  await ensureFgSession();
  return fgRequest(`reviews/${id}/decision`, { method: "POST", body: JSON.stringify(payload) });
}

export async function fetchFgQaQueue() {
  await ensureFgSession();
  return fgRequest<{ submissions: import("./fg-types").FgSubmissionRow[] }>("qa");
}

export async function fetchFgQa(id: string) {
  await ensureFgSession();
  return fgRequest<Record<string, unknown>>(`qa/${id}`);
}

export async function decideFgQa(
  id: string,
  payload: { decision: string; reviewNote: string; idempotencyKey: string }
) {
  await ensureFgSession();
  return fgRequest(`qa/${id}/decision`, { method: "POST", body: JSON.stringify(payload) });
}

export async function searchFgVehicles(query: string, options?: { formCode?: string }) {
  await ensureFgSession();
  const params = new URLSearchParams({ q: query });
  if (options?.formCode) {
    params.set("formCode", options.formCode);
  }
  return fgRequest<{ results: import("./fg-types").FgVehicleResult[] }>(`vehicles?${params.toString()}`);
}
