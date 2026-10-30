import type { DefaultOptions } from "@tanstack/react-query";

import { queryRetryDelay, shouldRetryQuery } from "./upstream-status";

/** Lists and dashboards may be up to 30s old before a remount or reconnect refetches them. */
export const QUERY_STALE_TIME_MS = 30_000;
/** One automatic retry (with backoff) for a dropped connection or a restarting API. */
export const QUERY_RETRY_LIMIT = 1;

/**
 * Shared react-query defaults for slow mobile networks:
 * - no refetch on every tab focus; reconnect refetches only stale queries
 * - polling (where a screen opts in) pauses while the tab is hidden
 * - one retry with exponential backoff, only for network/5xx-upstream failures
 * - mutations never replay automatically; the user retries them
 */
export const APP_QUERY_DEFAULT_OPTIONS = {
  queries: {
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
    retry: (failureCount: number, error: unknown) =>
      failureCount < QUERY_RETRY_LIMIT && shouldRetryQuery(failureCount, error),
    retryDelay: queryRetryDelay
  },
  mutations: { retry: false }
} satisfies DefaultOptions;
