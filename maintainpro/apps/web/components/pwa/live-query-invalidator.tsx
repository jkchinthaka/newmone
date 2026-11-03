"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { onDataChanged } from "@/lib/live-data";

/**
 * A change saved in this tab or another tab marks every cached query stale and refetches the
 * ones on screen, so dashboards, counts, badges and lists update without a page reload.
 */
export function LiveQueryInvalidator() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let timer: number | null = null;
    const unsubscribe = onDataChanged(() => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        // Queries already fetching (the saving screen's own invalidation) are left to finish.
        void queryClient.invalidateQueries({
          refetchType: "active",
          predicate: (query) => query.state.fetchStatus !== "fetching"
        });
      }, 250);
    });
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [queryClient]);
  return null;
}
