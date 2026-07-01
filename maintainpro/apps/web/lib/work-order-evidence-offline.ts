const OFFLINE_QUEUE_KEY = "maintainpro:work-order-evidence-offline-queue";

export type OfflineEvidenceDraft = {
  clientGeneratedId: string;
  workOrderId: string;
  evidenceType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note?: string;
  capturedAt?: string;
  offlineCreatedAt: string;
  syncStatus: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  syncError?: string;
};

export function readOfflineEvidenceQueue(): OfflineEvidenceDraft[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as OfflineEvidenceDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeOfflineEvidenceQueue(items: OfflineEvidenceDraft[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
}

export function enqueueOfflineEvidenceDraft(draft: Omit<OfflineEvidenceDraft, "syncStatus" | "offlineCreatedAt">) {
  const queue = readOfflineEvidenceQueue();
  if (queue.some((item) => item.clientGeneratedId === draft.clientGeneratedId)) {
    return queue;
  }

  const next: OfflineEvidenceDraft[] = [
    {
      ...draft,
      offlineCreatedAt: new Date().toISOString(),
      syncStatus: "PENDING"
    },
    ...queue
  ];
  writeOfflineEvidenceQueue(next);
  return next;
}

export function updateOfflineEvidenceDraft(
  clientGeneratedId: string,
  patch: Partial<Pick<OfflineEvidenceDraft, "syncStatus" | "syncError">>
) {
  const queue = readOfflineEvidenceQueue().map((item) =>
    item.clientGeneratedId === clientGeneratedId ? { ...item, ...patch } : item
  );
  writeOfflineEvidenceQueue(queue);
  return queue;
}

export function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
