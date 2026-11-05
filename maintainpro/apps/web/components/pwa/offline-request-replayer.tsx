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

function failureStatus(error: unknown): number | undefined {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" ? status : undefined;
}

/** A sign-in problem (expired session) is fixed by signing in again, so the report must stay queued. */
function isAwaitingSignIn(error: unknown): boolean {
  const status = failureStatus(error);
  return status === 401 || status === 403;
}

/** A 4xx (other than sign-in, timeout or rate limit) will not succeed on retry, so it is marked FAILED for good. */
function isPermanentFailure(error: unknown): boolean {
  const status = failureStatus(error);
  return (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    status !== 401 &&
    status !== 403 &&
    status !== 408 &&
    status !== 429
  );
}

/** Wait before trying again after a temporary failure (backend restarting, slow network, rate limit). */
const RETRY_DELAY_MS = 30_000;

/**
 * Sends issues that were reported while offline once the device is online again and the same
 * person is signed in. The saved idempotency key means a retry never creates a second request.
 */
export function OfflineRequestReplayer({ ready }: { ready: boolean }) {
  const running = useRef(false);

  useEffect(() => {
    if (!ready) return;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

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
            const awaitingSignIn = isAwaitingSignIn(error);
            updateOfflineAction(item.localActionId, {
              status: permanent ? "FAILED" : "PENDING",
              syncState: permanent ? "CONFLICT" : "QUEUED",
              // Signing in again is not a failed attempt, so the report keeps its retries.
              // Temporary failures stop at 4 so the report stays replayable (the queue skips items at 5)
              // and goes out as soon as the server or the network recovers.
              retryCount: permanent ? 5 : awaitingSignIn ? item.retryCount : Math.min(item.retryCount + 1, 4),
              lastError: getApiErrorMessage(error, "Could not send the offline report.")
            });
            if (permanent) {
              toast.error(`An offline report could not be sent: ${getApiErrorMessage(error, "please report it again.")}`);
            } else {
              // Signed out: resume on the next online event / sign-in. Otherwise try again shortly.
              if (!awaitingSignIn) {
                clearTimeout(retryTimer);
                retryTimer = setTimeout(() => void replay(), RETRY_DELAY_MS);
              }
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
    return () => {
      clearTimeout(retryTimer);
      window.removeEventListener("online", replay);
    };
  }, [ready]);

  return null;
}
