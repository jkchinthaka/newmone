import { apiClient, getApiErrorMessage } from "@/lib/api-client";

export type CaptureLocation = { latitude: number; longitude: number; accuracyMeters?: number };

export type PhotoUploadResult =
  | { ok: true; attachmentId: string }
  /** blocked: photo storage is not set up on the server, so nothing can be stored. */
  | { ok: false; blocked: boolean; message: string };

type ApiEnvelope<T> = { data: T };
type UploadRequestResult = {
  ok: boolean;
  status?: string;
  attachmentId?: string;
  uploadMethod?: string;
  message?: string;
};

/**
 * One work-order file upload: request -> bytes -> confirm. Used by the live camera (photos) and the
 * document picker. The server checks type, size, duplicate photos and the job's state.
 */
export async function uploadWorkOrderFile(input: {
  workOrderId: string;
  file: Blob;
  fileName: string;
  mimeType: string;
  evidenceType: string;
  note?: string;
  source?: string;
  location?: CaptureLocation | null;
}): Promise<PhotoUploadResult> {
  try {
    const requested = await apiClient.post<ApiEnvelope<UploadRequestResult>>(
      `/work-orders/${input.workOrderId}/evidence/upload-request`,
      {
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.file.size,
        evidenceType: input.evidenceType,
        note: input.note?.trim() || undefined,
        // Server time is what counts; this is only the phone's own clock for reference.
        capturedAt: new Date().toISOString(),
        source: input.source,
        clientGeneratedId: crypto.randomUUID(),
        ...(input.location
          ? {
              latitude: input.location.latitude,
              longitude: input.location.longitude,
              accuracyMeters: input.location.accuracyMeters
            }
          : {})
      }
    );
    const result = requested.data.data;
    if (!result.ok || !result.attachmentId || result.uploadMethod !== "direct") {
      return {
        ok: false,
        blocked: result.status === "blocked",
        message: result.message || "Photo upload is not available."
      };
    }
    await apiClient.post(
      `/work-orders/${input.workOrderId}/evidence/${result.attachmentId}/content`,
      await input.file.arrayBuffer(),
      { headers: { "Content-Type": "application/octet-stream" }, transformRequest: [(data) => data] }
    );
    const confirmed = await apiClient.post<ApiEnvelope<{ ok: boolean; message: string }>>(
      `/work-orders/${input.workOrderId}/evidence/confirm`,
      { attachmentId: result.attachmentId }
    );
    if (!confirmed.data.data.ok) {
      return { ok: false, blocked: false, message: confirmed.data.data.message || "Photo upload could not be confirmed." };
    }
    return { ok: true, attachmentId: result.attachmentId };
  } catch (error) {
    return { ok: false, blocked: false, message: getApiErrorMessage(error, "Photo upload failed.") };
  }
}

/** Best-effort phone location: resolves null when not allowed, not available, or too slow. */
export function readCaptureLocation(timeoutMs = 8000): Promise<CaptureLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: CaptureLocation | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer);
        finish({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy
        });
      },
      () => {
        window.clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}

/** Scales a camera frame down to at most maxSide px on the long edge (keeps uploads small on mobile data). */
export function fitWithin(width: number, height: number, maxSide = 1600): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Photo evidence must come from the live camera; documents (invoice, quotation...) may be files. */
export const LIVE_PHOTO_EVIDENCE_TYPES = new Set(["BEFORE_PHOTO", "AFTER_PHOTO", "DAMAGE_PHOTO", "PART_PHOTO"]);

export function isLivePhotoEvidenceType(type: string): boolean {
  return LIVE_PHOTO_EVIDENCE_TYPES.has(type);
}
