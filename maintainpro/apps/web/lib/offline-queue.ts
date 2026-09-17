/**
 * Phase 2 offline write foundation.
 *
 * Stores action metadata only (not file bytes, passwords, or tokens).
 * Domain engines (Requests / WO / etc.) enqueue specific action types later;
 * this module is the shared queue contract.
 *
 * Idempotency: every mutating offline action MUST carry an idempotencyKey so
 * retries after reconnect do not create duplicate server transactions.
 *
 * Persistence: sync localStorage for immediate UI + durable IndexedDB mirror.
 */

import { idbGetAll, idbPutAll } from "./offline/idb-store";

export type OfflineActionStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";

export type OfflineQueueItem = {
  localActionId: string;
  idempotencyKey: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  status: OfflineActionStatus;
  lastError?: string;
  /** Optional server version for conflict detection */
  expectedServerUpdatedAt?: string;
  syncState?: "QUEUED" | "IN_FLIGHT" | "CONFLICT" | "DONE";
};

const OFFLINE_QUEUE_KEY = "maintainpro:offline-action-queue:v1";

function persistMirror(items: OfflineQueueItem[]): void {
  void idbPutAll(items);
}

export function readOfflineActionQueue(): OfflineQueueItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as OfflineQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeOfflineActionQueue(items: OfflineQueueItem[]): void {
  if (typeof window === "undefined") {
    return;
  }
  // Never persist secrets — callers must strip tokens/passwords from payload first.
  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  persistMirror(items);
}

export function enqueueOfflineAction(
  draft: Omit<OfflineQueueItem, "createdAt" | "retryCount" | "status">
): OfflineQueueItem[] {
  const queue = readOfflineActionQueue();
  if (queue.some((item) => item.idempotencyKey === draft.idempotencyKey)) {
    return queue;
  }

  const next: OfflineQueueItem[] = [
    {
      ...draft,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: "PENDING",
      syncState: "QUEUED"
    },
    ...queue
  ];
  writeOfflineActionQueue(next);
  return next;
}

export function updateOfflineAction(
  localActionId: string,
  patch: Partial<Pick<OfflineQueueItem, "status" | "lastError" | "retryCount" | "syncState">>
): OfflineQueueItem[] {
  const queue = readOfflineActionQueue().map((item) =>
    item.localActionId === localActionId ? { ...item, ...patch } : item
  );
  writeOfflineActionQueue(queue);
  return queue;
}

export function pendingOfflineActionCount(
  queue: readonly OfflineQueueItem[] = readOfflineActionQueue()
): number {
  return queue.filter((item) => item.status === "PENDING" || item.status === "FAILED").length;
}

/** Hydrate from IndexedDB when localStorage is empty (e.g. after storage eviction). */
export async function hydrateOfflineQueueFromIdb(): Promise<OfflineQueueItem[]> {
  const local = readOfflineActionQueue();
  if (local.length > 0) return local;
  const fromIdb = await idbGetAll<OfflineQueueItem>();
  if (fromIdb.length > 0) {
    writeOfflineActionQueue(fromIdb);
  }
  return fromIdb;
}
