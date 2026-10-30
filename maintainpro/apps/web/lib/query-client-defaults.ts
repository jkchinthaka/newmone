import type { DefaultOptions } from "@tanstack/react-query";

import { LIVE_REFRESH_INTERVAL_MS } from "./live-data";
import { queryRetryDelay, shouldRetryQuery } from "./upstream-status";

/** Lists and dashboards may be up to 30s old before a remount or reconnect refetches them. */
export const QUERY_STALE_TIME_MS = 30_000;
/** One automatic retry (with backoff) for a dropped connection or a restarting API. */
export const QUERY_RETRY_LIMIT = 1;

/**
 * Shared react-query defaults for slow mobile networks:
 * - tab focus and reconnect refetch only stale queries; visible screens re-check every 30s
 * - polling (where a screen opts in) pauses while the tab is hidden
 * - one retry with exponential backoff, only for network/5xx-upstream failures
 * - mutations never replay automatically; the user retries them
 */
export const APP_QUERY_DEFAULT_OPTIONS = {
  queries: {
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: 5 * 60_000,
    // Automatic updates (lib/live-data.ts): back on the tab refetches stale data, and every open
    // screen re-checks on an interval while visible. Saved changes invalidate immediately.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    retry: (failureCount: number, error: unknown) =>
      failureCount < QUERY_RETRY_LIMIT && shouldRetryQuery(failureCount, error),
    retryDelay: queryRetryDelay
  },
  mutations: { retry: false }
} satisfies DefaultOptions;
