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
export function isRealtimeDisabled(value: string | undefined): boolean {
  return ["false", "0", "off"].includes((value ?? "").trim().toLowerCase());
}

export const REALTIME_DISABLED = isRealtimeDisabled(process.env.NEXT_PUBLIC_REALTIME_NOTIFICATIONS);

export function realtimeSocketOptions() {
  return {
    // One handshake. A refused socket must not keep opening new websocket attempts;
    // the notification bell already polls through the BFF.
    transports: ["websocket", "polling"] as string[],
    tryAllTransports: true,
    withCredentials: true,
    reconnection: false,
    timeout: 8000
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
