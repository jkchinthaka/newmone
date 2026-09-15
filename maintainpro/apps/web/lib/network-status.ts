/**
 * Browser online/offline awareness for the responsive shell.
 * Does not imply server confirmation of mutations — callers must still await API success.
 */

export type NetworkConnectionState = "online" | "offline" | "unknown";

export function getBrowserNetworkState(): NetworkConnectionState {
  if (typeof navigator === "undefined") {
    return "unknown";
  }
  return navigator.onLine ? "online" : "offline";
}

export function subscribeToNetworkChanges(
  onChange: (state: NetworkConnectionState) => void
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const emit = () => onChange(getBrowserNetworkState());
  window.addEventListener("online", emit);
  window.addEventListener("offline", emit);
  return () => {
    window.removeEventListener("online", emit);
    window.removeEventListener("offline", emit);
  };
}

export function networkStatusMessage(state: NetworkConnectionState): string | null {
  if (state === "offline") {
    return "Offline — changes requiring server confirmation may be queued.";
  }
  return null;
}

export function connectionRestoredMessage(): string {
  return "Connection restored.";
}
