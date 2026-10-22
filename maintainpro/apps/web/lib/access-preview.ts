export const PREVIEW_STORAGE_KEY = "maintainpro.access-preview.v1";
export type AccessPreview = { userId: string; label: string };

export function readAccessPreview(): AccessPreview | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(PREVIEW_STORAGE_KEY) ?? "null");
    return typeof value?.userId === "string" && value.userId && typeof value?.label === "string" ? value : null;
  } catch { return null; }
}

export function startAccessPreview(userId: string, label: string) {
  window.sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({ userId, label }));
  // Reload clears all caller-scoped query caches before target reads begin.
  window.location.assign("/action-center");
}

export function stopAccessPreview() {
  window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  window.location.assign("/admin/users");
}
