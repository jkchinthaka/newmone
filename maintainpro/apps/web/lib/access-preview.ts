export const PREVIEW_STORAGE_KEY = "maintainpro.access-preview.v1";
export type AccessPreview = { userId: string; label: string };

export function readAccessPreview(): AccessPreview | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(PREVIEW_STORAGE_KEY) ?? "null");
    return typeof value?.userId === "string" && value.userId && typeof value?.label === "string" ? value : null;
  } catch { return null; }
}

export async function startAccessPreview(userId: string, label: string) {
  const { apiClient } = await import("@/lib/api-client");
  await apiClient.post("/admin/access-preview/start", { userId });
  window.sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({ userId, label }));
  window.location.assign("/action-center");
}

export async function stopAccessPreview() {
  const current = readAccessPreview();
  window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  try {
    if (current?.userId) {
      const { apiClient } = await import("@/lib/api-client");
      await apiClient.post("/admin/access-preview/stop", { userId: current.userId });
    }
  } catch (error) {
    if (current) window.sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(current));
    throw error;
  }
  window.location.assign("/admin/users");
}
