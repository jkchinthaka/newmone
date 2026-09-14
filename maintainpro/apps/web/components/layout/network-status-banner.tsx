"use client";

import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import {
  connectionRestoredMessage,
  getBrowserNetworkState,
  networkStatusMessage,
  subscribeToNetworkChanges,
  type NetworkConnectionState
} from "@/lib/network-status";

/**
 * Unobtrusive online/offline indicator for the dashboard shell.
 * Toast on restore is informational only — queued mutations still need sync confirmation.
 */
export function NetworkStatusBanner() {
  const [state, setState] = useState<NetworkConnectionState>("unknown");
  const previousRef = useRef<NetworkConnectionState>("unknown");

  useEffect(() => {
    const initial = getBrowserNetworkState();
    setState(initial);
    previousRef.current = initial;

    return subscribeToNetworkChanges((next) => {
      const previous = previousRef.current;
      previousRef.current = next;
      setState(next);

      if (previous === "offline" && next === "online") {
        toast.success(connectionRestoredMessage());
      }
    });
  }, []);

  const message = networkStatusMessage(state);
  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950 sm:text-sm"
    >
      <WifiOff size={16} aria-hidden className="shrink-0" />
      <span>{message}</span>
      <span className="sr-only">Network status: offline</span>
    </div>
  );
}

export function NetworkStatusIcon({ className }: { className?: string }) {
  const [state, setState] = useState<NetworkConnectionState>("unknown");

  useEffect(() => {
    setState(getBrowserNetworkState());
    return subscribeToNetworkChanges(setState);
  }, []);

  if (state === "offline") {
    return <WifiOff className={className} size={18} aria-label="Offline" />;
  }

  return <Wifi className={className} size={18} aria-label="Online" />;
}
