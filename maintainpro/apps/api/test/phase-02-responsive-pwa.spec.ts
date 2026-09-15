import {
  connectionRestoredMessage,
  getBrowserNetworkState,
  networkStatusMessage
} from "../../web/lib/network-status";
import {
  createIdempotencyKey,
  idempotencyHeaders,
  stableIdempotencyKey,
  withIdempotencyBody
} from "../../web/lib/idempotency";
import {
  enqueueOfflineAction,
  pendingOfflineActionCount,
  readOfflineActionQueue,
  updateOfflineAction,
  writeOfflineActionQueue
} from "../../web/lib/offline-queue";
import { shouldPreferMobileRecordCards } from "../../web/lib/data-table-mobile";
import {
  PWA_DISPLAY,
  PWA_SCOPE,
  PWA_START_URL
} from "../../web/lib/pwa-metadata";

describe("Phase 2 responsive / PWA foundations", () => {
  const memory = new Map<string, string>();

  beforeAll(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => memory.get(key) ?? null,
          setItem: (key: string, value: string) => {
            memory.set(key, value);
          },
          removeItem: (key: string) => {
            memory.delete(key);
          }
        }
      }
    });
  });

  beforeEach(() => {
    memory.clear();
    writeOfflineActionQueue([]);
  });

  it("exposes offline network messaging without claiming sync success", () => {
    expect(networkStatusMessage("offline")).toMatch(/queued/i);
    expect(networkStatusMessage("online")).toBeNull();
    expect(connectionRestoredMessage()).toMatch(/restored/i);
  });

  it("defaults browser network state safely when navigator is absent", () => {
    expect(["online", "offline", "unknown"]).toContain(getBrowserNetworkState());
  });

  it("creates unique idempotency keys for retry-safe mutations", () => {
    const a = createIdempotencyKey("wo");
    const b = createIdempotencyKey("wo");
    expect(a).not.toEqual(b);
    expect(a.startsWith("wo_")).toBe(true);
    expect(idempotencyHeaders(a)["Idempotency-Key"]).toBe(a);
    expect(withIdempotencyBody({ action: "complete" }, a)).toEqual({
      action: "complete",
      idempotencyKey: a
    });
    expect(stableIdempotencyKey("evidence", "local-1")).toBe("evidence:local-1");
  });

  it("deduplicates offline queue entries by idempotency key", () => {
    enqueueOfflineAction({
      localActionId: "a1",
      idempotencyKey: "key-1",
      actionType: "EVIDENCE_UPLOAD_META",
      payload: { fileName: "before.jpg" }
    });
    enqueueOfflineAction({
      localActionId: "a2",
      idempotencyKey: "key-1",
      actionType: "EVIDENCE_UPLOAD_META",
      payload: { fileName: "before.jpg" }
    });

    expect(readOfflineActionQueue()).toHaveLength(1);
    expect(pendingOfflineActionCount()).toBe(1);

    updateOfflineAction("a1", { status: "SYNCED" });
    expect(pendingOfflineActionCount()).toBe(0);
  });

  it("prefers mobile record cards below the md breakpoint", () => {
    expect(shouldPreferMobileRecordCards(375)).toBe(true);
    expect(shouldPreferMobileRecordCards(1280)).toBe(false);
  });

  it("keeps PWA installability metadata coherent", () => {
    expect(PWA_START_URL).toBe("/splash");
    expect(PWA_SCOPE).toBe("/");
    expect(PWA_DISPLAY).toBe("standalone");
  });
});
