import { useEffect, useRef } from "react";

/**
 * Automatic data updates without reloading the page.
 *
 * Three signals make every open screen fetch fresh data:
 * 1. A change saved in this browser (any successful POST/PUT/PATCH/DELETE through apiClient)
 *    — announced here and to the other open tabs (BroadcastChannel), so lists, counts and
 *    badges catch up straight away.
 * 2. Coming back to the tab or the device getting its connection back.
 * 3. A new notification on the realtime socket (someone else changed something for this user).
 * 4. A steady interval while the tab is visible, which picks up any other change by other people.
 *
 * React Query screens are refreshed by the dashboard QueryClient (invalidate on signal 1,
 * refetchOnWindowFocus / refetchInterval for 2 and 3). Screens that load with useEffect use
 * useLiveRefresh(). Background tabs do not poll.
 */
export const LIVE_REFRESH_INTERVAL_MS = 30_000;
export const DATA_CHANGED_EVENT = "maintainpro:data-changed";
const CHANNEL_NAME = "maintainpro-data";

export type DataChangedDetail = { path: string; at: number; fromOtherTab?: boolean };

/** Writes that do not change business data (sign-in, session, telemetry) do not trigger refreshes. */
const IGNORED_WRITE_PREFIXES = ["/auth", "/telemetry", "/client-errors", "/tenants/switch"];

/** POSTs that only read or check (previews, duplicate checks, scans) change nothing. */
const READ_ONLY_POST_ENDINGS = ["/preview", "/simulate", "/validate", "/duplicate-check", "/scan-lookup"];

export function shouldAnnounceWrite(method: string | undefined, path: string): boolean {
  const verb = String(method ?? "get").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(verb)) return false;
  const clean = path.split("?")[0] ?? path;
  if (READ_ONLY_POST_ENDINGS.some((ending) => clean.endsWith(ending))) return false;
  return !IGNORED_WRITE_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}

let channel: BroadcastChannel | null | undefined;
function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  try {
    channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);
    channel?.addEventListener("message", (event: MessageEvent<DataChangedDetail>) => {
      if (!event.data || typeof event.data.path !== "string") return;
      window.dispatchEvent(new CustomEvent<DataChangedDetail>(DATA_CHANGED_EVENT, { detail: { ...event.data, fromOtherTab: true } }));
    });
  } catch {
    channel = null;
  }
  return channel;
}

/** Announce a saved change to this tab and (unless `broadcast: false`) the other open tabs. */
export function notifyDataChanged(path: string, options: { broadcast?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const detail: DataChangedDetail = { path, at: Date.now() };
  window.dispatchEvent(new CustomEvent<DataChangedDetail>(DATA_CHANGED_EVENT, { detail }));
  if (options.broadcast === false) return;
  try {
    getChannel()?.postMessage(detail);
  } catch {
    // Closed channel: this tab still refreshed.
  }
}

/** Listen for saved changes (this tab or another tab). Returns the unsubscribe function. */
export function onDataChanged(listener: (detail: DataChangedDetail) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  getChannel();
  const handler = (event: Event) => listener((event as CustomEvent<DataChangedDetail>).detail);
  window.addEventListener(DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
}

function isVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

/**
 * Re-run `refresh` (silently: keep the current data on screen) when data changes, when the tab
 * becomes visible again or reconnects, and every interval while visible. Bursts are merged.
 */
export function useLiveRefresh(
  refresh: () => void | Promise<unknown>,
  options: { enabled?: boolean; intervalMs?: number } = {}
) {
  const { enabled = true, intervalMs = LIVE_REFRESH_INTERVAL_MS } = options;
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let timer: number | null = null;
    let lastRun = Date.now();
    const run = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (!isVisible()) return;
        lastRun = Date.now();
        void latest.current();
      }, 250);
    };
    const onVisible = () => {
      // Only refetch on return when the data is older than a few seconds.
      if (isVisible() && Date.now() - lastRun > 5_000) run();
    };
    const interval = window.setInterval(() => {
      if (isVisible()) run();
    }, Math.max(5_000, intervalMs));
    const unsubscribe = onDataChanged(() => run());
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", run);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.clearInterval(interval);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", run);
    };
  }, [enabled, intervalMs]);
}
