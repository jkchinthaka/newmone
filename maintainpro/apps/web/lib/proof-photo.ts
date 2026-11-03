import { apiClient } from "@/lib/api-client";

/** Opens a stored proof photo (fuel receipt, meter photo, GRN) in a new tab. */
export async function openProofPhoto(key: string) {
  const response = await apiClient.get("/proof-photos", { params: { key }, responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Stored proof keys look like proof/<company>/<kind>/<month>/<id>.jpg. */
export function isProofPhotoKey(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("proof/");
}
