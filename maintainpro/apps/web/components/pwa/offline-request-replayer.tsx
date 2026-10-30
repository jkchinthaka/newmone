"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { createMaintenanceRequest } from "@/lib/maintenance-requests-api";
import {
  hydrateOfflineQueueFromIdb,
  pruneSyncedOfflineActions,
  readOfflineActionQueue,
  replayableOfflineActions,
  updateOfflineAction
} from "@/lib/offline-queue";
import { getActiveTenantId } from "@/lib/tenant-context";
import { currentStoredUserId } from "@/lib/user-scoped-storage";

/** A 4xx (other than timeout / rate limit) will not succeed on retry, so it is marked FAILED for good. */
function isPermanentFailure(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/**
 * Sends issues that were reported while offline once the device is online again and the same
 * person is signed in. The saved idempotency key means a retry never creates a second request.
 */
export function OfflineRequestReplayer({ ready }: { ready: boolean }) {
  const running = useRef(false);

  useEffect(() => {
    if (!ready) return;

    const replay = async () => {
      if (running.current || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
      running.current = true;
      try {
        await hydrateOfflineQueueFromIdb();
        pruneSyncedOfflineActions();
        const items = replayableOfflineActions(
          readOfflineActionQueue(),
          { userId: currentStoredUserId(), tenantId: getActiveTenantId() },
          "MAINTENANCE_REQUEST_CREATE"
        );
        for (const item of items) {
          updateOfflineAction(item.localActionId, { status: "SYNCING", syncState: "IN_FLIGHT" });
          try {
            const created = await createMaintenanceRequest(item.payload);
            updateOfflineAction(item.localActionId, {
              status: "SYNCED",
              syncState: "DONE",
              serverReference: created.requestNumber
            });
            toast.success(`Your offline report was sent: ${created.requestNumber}.`);
          } catch (error) {
            const permanent = isPermanentFailure(error);
            updateOfflineAction(item.localActionId, {
              status: permanent ? "FAILED" : "PENDING",
              syncState: permanent ? "CONFLICT" : "QUEUED",
              retryCount: permanent ? 5 : item.retryCount + 1,
              lastError: getApiErrorMessage(error, "Could not send the offline report.")
            });
            if (permanent) {
              toast.error(`An offline report could not be sent: ${getApiErrorMessage(error, "please report it again.")}`);
            } else {
              break;
            }
          }
        }
      } finally {
        running.current = false;
      }
    };

    void replay();
    window.addEventListener("online", replay);
    return () => window.removeEventListener("online", replay);
  }, [ready]);

  return null;
}
