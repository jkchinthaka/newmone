import type { FgApiError, FgEnvelope, FgFormCard, FgKpis } from "./fg-types";

export const FG_KPI_CARDS: Array<{ key: keyof FgKpis; label: string }> = [
  { key: "todayRecords", label: "Today records" },
  { key: "draftInProgress", label: "Draft / in progress" },
  { key: "pendingSupervisor", label: "Pending supervisor" },
  { key: "pendingQa", label: "Pending QA" },
  { key: "completed", label: "Completed" },
  { key: "needsAttention", label: "Exceptions / needs attention" }
];

export function emptyFgKpis(): FgKpis {
  return {
    todayRecords: 0,
    draftInProgress: 0,
    pendingSupervisor: 0,
    pendingQa: 0,
    completed: 0,
    needsAttention: 0
  };
}

export function mapDashboardKpis(raw: Partial<FgKpis> | null | undefined): FgKpis {
  const empty = emptyFgKpis();
  if (!raw) {
    return empty;
  }
  return {
    todayRecords: Number.isFinite(raw.todayRecords) ? Number(raw.todayRecords) : 0,
    draftInProgress: Number.isFinite(raw.draftInProgress) ? Number(raw.draftInProgress) : 0,
    pendingSupervisor: Number.isFinite(raw.pendingSupervisor) ? Number(raw.pendingSupervisor) : 0,
    pendingQa: Number.isFinite(raw.pendingQa) ? Number(raw.pendingQa) : 0,
    completed: Number.isFinite(raw.completed) ? Number(raw.completed) : 0,
    needsAttention: Number.isFinite(raw.needsAttention) ? Number(raw.needsAttention) : 0
  };
}

export function controlledFormOpenAction(form: Pick<FgFormCard, "code" | "multiplicity" | "statusLabel">): {
  kind: "openToday";
  label: string;
  secondaryLabel: string;
} {
  const started = form.statusLabel !== "NOT STARTED";
  if (form.code === "NMS/PPU/CL/24") {
    return {
      kind: "openToday",
      label: started ? "Open today's record" : "Open today's record",
      secondaryLabel: "One record/day"
    };
  }
  if (form.code === "NMS/PPU/CL/18") {
    return { kind: "openToday", label: "Open today's record", secondaryLabel: "One record/day" };
  }
  if (form.code === "NMS/PPU/CL/30") {
    return { kind: "openToday", label: "Open today's inspection", secondaryLabel: "One record/day" };
  }
  return { kind: "openToday", label: "Open today's record", secondaryLabel: "Controlled daily record" };
}

export function parseFgEnvelope<T>(payload: unknown): FgEnvelope<T> {
  if (!payload || typeof payload !== "object") {
    return {
      data: null,
      meta: null,
      error: { code: "INVALID_RESPONSE", message: "The FG service returned an unexpected response." }
    };
  }
  const body = payload as FgEnvelope<T>;
  if (body.error && typeof body.error === "object") {
    return {
      data: body.data ?? null,
      meta: body.meta ?? null,
      error: {
        code: String(body.error.code || "REQUEST_FAILED"),
        message: safeFgErrorMessage(body.error.message),
        fieldErrors: body.error.fieldErrors ?? {}
      }
    };
  }
  return { data: (body.data ?? null) as T, meta: body.meta ?? {}, error: null };
}

export function safeFgErrorMessage(raw: unknown, fallback = "The FG request failed. Try again."): string {
  const text = String(raw ?? "").trim();
  if (!text) {
    return fallback;
  }
  const lowered = text.toLowerCase();
  if (
    lowered.includes("traceback") ||
    lowered.includes("operationalerror") ||
    lowered.includes("econnrefused") ||
    lowered.includes("secret") ||
    lowered.includes("password")
  ) {
    return fallback;
  }
  return text.slice(0, 280);
}

export function fieldErrorsFor(error: FgApiError | null, fieldName: string): string[] {
  if (!error?.fieldErrors) {
    return [];
  }
  return error.fieldErrors[fieldName] ?? error.fieldErrors[fieldName.replace("response_", "")] ?? [];
}

export function stableActionKey(scope: string, entityId: string): string {
  const storageKey = `fg-idempotency:${scope}:${entityId}`;
  if (typeof sessionStorage === "undefined") {
    return `${scope}:${entityId}`;
  }
  const existing = sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  sessionStorage.setItem(storageKey, next);
  return next;
}

export function clearActionKey(scope: string, entityId: string): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.removeItem(`fg-idempotency:${scope}:${entityId}`);
}

export function djangoPrintHref(printPath: string): string {
  const trimmed = printPath.startsWith("/") ? printPath : `/${printPath}`;
  if (trimmed.startsWith("/fg/")) {
    return trimmed;
  }
  return `/fg${trimmed}`;
}

export function statusTone(label: string): "neutral" | "progress" | "review" | "danger" | "success" {
  const value = label.toUpperCase();
  if (value.includes("COMPLETE") || value.includes("RELEASE")) {
    return "success";
  }
  if (value.includes("ATTENTION") || value.includes("REJECT") || value.includes("HOLD")) {
    return "danger";
  }
  if (value.includes("QA") || value.includes("REVIEW")) {
    return "review";
  }
  if (value.includes("PROGRESS") || value.includes("DRAFT") || value.includes("RECORD")) {
    return "progress";
  }
  return "neutral";
}
