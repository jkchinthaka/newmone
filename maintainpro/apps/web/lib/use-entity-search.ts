"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "./api-client";

export interface UseEntitySearchOptions<T> {
  /** API path relative to the apiClient baseURL, e.g. "/vehicles" */
  endpoint: string;
  /** Query string param name for the free-text search. Defaults to "q". */
  searchParam?: string;
  /** Page size sent to the API. Defaults to 20. */
  pageSize?: number;
  /** Debounce delay in ms. Defaults to 250. */
  debounceMs?: number;
  /** Optional extra query params (filters, status, etc.). */
  extraParams?: Record<string, string | number | boolean | undefined>;
  /**
   * Pluck the array out of the API envelope.
   * Defaults to (response) => response.data.data ?? response.data ?? [].
   */
  extractItems?: (responseBody: unknown) => T[];
}

export interface UseEntitySearchResult<T> {
  query: string;
  setQuery: (value: string) => void;
  results: T[];
  loading: boolean;
  error: string | null;
  /** Force a refresh with the current query. */
  refresh: () => void;
}

function defaultExtractor<T>(body: unknown): T[] {
  if (!body || typeof body !== "object") return [];
  const wrapper = body as { data?: unknown };
  const inner = wrapper.data;
  if (Array.isArray(inner)) return inner as T[];
  if (inner && typeof inner === "object") {
    const nested = (inner as { data?: unknown; items?: unknown }).data ?? (inner as { items?: unknown }).items;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

/**
 * Debounced master-data search hook. Designed for `<EntityPicker>` and any
 * autosuggest input that pulls from a REST endpoint exposing `?q=` search.
 */
export function useEntitySearch<T = Record<string, unknown>>(
  options: UseEntitySearchOptions<T>
): UseEntitySearchResult<T> {
  const {
    endpoint,
    searchParam = "q",
    pageSize = 20,
    debounceMs = 250,
    extraParams,
    extractItems
  } = options;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Track the latest request so out-of-order responses are ignored.
  const requestIdRef = useRef(0);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  // Stringify extraParams once per render to keep effect deps stable.
  const extraParamsKey = extraParams ? JSON.stringify(extraParams) : "";

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      const params: Record<string, string | number | boolean> = { pageSize };
      if (query.trim().length > 0) {
        params[searchParam] = query.trim();
      }
      if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
          if (value !== undefined && value !== null && value !== "") {
            params[key] = value;
          }
        }
      }

      apiClient
        .get(endpoint, { params })
        .then((response) => {
          if (requestId !== requestIdRef.current) return;
          const items = (extractItems ?? defaultExtractor<T>)(response.data);
          setResults(items);
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return;
          const message = err instanceof Error ? err.message : "Search failed";
          setError(message);
          setResults([]);
        })
        .finally(() => {
          if (requestId !== requestIdRef.current) return;
          setLoading(false);
        });
    }, debounceMs);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, endpoint, searchParam, pageSize, debounceMs, extraParamsKey, refreshKey]);

  return { query, setQuery, results, loading, error, refresh };
}
