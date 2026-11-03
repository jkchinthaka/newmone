"use client";

import { useEffect, useState } from "react";

import { readOfflineActionQueue } from "@/lib/offline-queue";
import { getActiveTenantId } from "@/lib/tenant-context";
import { currentStoredUserId } from "@/lib/user-scoped-storage";

/** Items this person still has to send (their own, this company, not yet sent). */
export function waitingOfflineCount(): number {
  const userId = currentStoredUserId();
  const tenantId = getActiveTenantId() ?? null;
  if (!userId) return 0;
  return readOfflineActionQueue().filter(
    (item) =>
      (item.status === "PENDING" || item.status === "SYNCING") &&
      item.ownerUserId === userId &&
      (item.tenantId ?? null) === tenantId
  ).length;
}

export function connectionMessage(offline: boolean, waiting: number): string | null {
  if (offline) {
    return waiting > 0
      ? `No internet. ${waiting} ${waiting === 1 ? "report is" : "reports are"} saved and will be sent when you are back online.`
      : "No internet. You can still report a problem; it is saved on this device and sent when you are back online.";
  }
  if (waiting > 0) {
    return `Sending ${waiting} saved ${waiting === 1 ? "report" : "reports"}...`;
  }
  return null;
}

/** Thin strip under the top bar: only appears when offline or when saved reports are waiting. */
export function ConnectionStatus() {
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
      setWaiting(waitingOfflineCount());
    };
    refresh();
    const timer = window.setInterval(refresh, 4000);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const message = connectionMessage(offline, waiting);
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`px-4 py-2 text-center text-sm font-medium ${
        offline ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"
      }`}
    >
      {message}
    </div>
  );
}
