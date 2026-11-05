import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { fitWithin } from "@/lib/work-order-photo-upload";

export type RequestPhotoLimits = { enabled: boolean; maxFileSizeMb: number; maxPhotos: number };
export type RequestPhotoRef = { id: string; fileName: string; mimeType: string; sizeBytes: number; uploadedById?: string | null };

export const DEFAULT_MAX_REQUEST_PHOTOS = 5;

export async function getRequestPhotoLimits(): Promise<RequestPhotoLimits> {
  const response = await apiClient.get<{ data: RequestPhotoLimits }>("/maintenance-requests/photo-limits");
  return response.data.data;
}

/** Phone pictures are often 5 MB or more; scale to 1600 px on the long edge and save as JPEG. */
export async function prepareRequestPhoto(file: File): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
  const baseName = (file.name || "photo").replace(/\.[a-z0-9]+$/i, "") || "photo";
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, 1600);
    if (width > 0 && height > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close?.();
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
        if (blob) return { blob, fileName: `${baseName}.jpg`, mimeType: "image/jpeg" };
      }
    }
  } catch {
    // Fall through: send the original when the browser cannot decode it.
  }
  return { blob: file, fileName: file.name || "photo.jpg", mimeType: file.type || "image/jpeg" };
}

export async function uploadRequestPhoto(requestId: string, file: File): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const prepared = await prepareRequestPhoto(file);
    await apiClient.post(
      `/maintenance-requests/${requestId}/photos`,
      await prepared.blob.arrayBuffer(),
      {
        params: { fileName: prepared.fileName, mimeType: prepared.mimeType },
        headers: { "Content-Type": "application/octet-stream" },
        transformRequest: [(data) => data]
      }
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, message: getApiErrorMessage(error, "The photo could not be added.") };
  }
}

export async function fetchRequestPhotoUrl(requestId: string, photoId: string): Promise<string> {
  const response = await apiClient.get(`/maintenance-requests/${requestId}/photos/${photoId}`, { responseType: "blob" });
  return URL.createObjectURL(response.data as Blob);
}

export async function deleteRequestPhoto(requestId: string, photoId: string): Promise<void> {
  await apiClient.delete(`/maintenance-requests/${requestId}/photos/${photoId}`);
}
