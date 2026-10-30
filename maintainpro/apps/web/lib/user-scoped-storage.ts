import { USER_KEY } from "@/lib/auth-storage";
import { getActiveTenantId } from "@/lib/tenant-context";

/**
 * Browser settings (saved filters and similar) are per person and per company. Without this a
 * shared workshop tablet shows the next person the last person's filters (for example "my jobs"
 * of someone else, or a technician id from another company).
 */
export function currentStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    const parsed = raw ? (JSON.parse(raw) as { id?: unknown }) : null;
    return typeof parsed?.id === "string" && parsed.id.trim() ? parsed.id.trim() : null;
  } catch {
    return null;
  }
}

export function userScopedStorageKey(base: string): string {
  let tenant = "none";
  try {
    tenant = getActiveTenantId() ?? "none";
  } catch {
    tenant = "none";
  }
  return `${base}:${tenant}:${currentStoredUserId() ?? "anon"}`;
}
