/**
 * Shared policy for the socket.io channels (notifications, fleet).
 *
 * Both gateways are served by the API origin (Nest), which is a different origin from the
 * BFF that carries every other request, so realtime is optional by design: where that
 * origin is not reachable from the browser (not exposed directly, proxy/firewall, TLS or
 * CORS mismatch) the handshake cannot complete and the UI keeps working from its REST
 * polling. That failure must stay quiet — one dev-only line per channel — instead of a
 * warning per reconnection attempt.
 */
const MAX_RECONNECTION_ATTEMPTS = 3;

export const REALTIME_DISABLED = ["false", "0", "off"].includes(
  (process.env.NEXT_PUBLIC_REALTIME_NOTIFICATIONS ?? "").trim().toLowerCase()
);

export function realtimeSocketOptions() {
  return {
    // Prefer a raw websocket, but let engine.io fall through to long-polling where
    // websocket upgrades are blocked rather than giving up on realtime completely.
    transports: ["websocket", "polling"] as string[],
    tryAllTransports: true,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000
  };
}

const reportedChannels = new Set<string>();

/** Log once per channel, dev only, so a real misconfiguration stays discoverable. */
export function reportRealtimeUnavailable(channel: string, reason: string): void {
  if (process.env.NODE_ENV === "production" || reportedChannels.has(channel)) {
    return;
  }

  reportedChannels.add(channel);
  // eslint-disable-next-line no-console
  console.info(
    `[${channel}] realtime channel unavailable (${reason}) — falling back to polling. ` +
      "Set NEXT_PUBLIC_REALTIME_NOTIFICATIONS=false to stop attempting it."
  );
}

export function clearRealtimeUnavailableReport(channel: string): void {
  reportedChannels.delete(channel);
}
