"use client";

import { useQuery } from "@tanstack/react-query";
import { isDatabaseUnavailableError } from "@/lib/api-client";
import { fetchWorkOrderQueueSummary } from "@/lib/work-order-queues-api";
import type { NavBadgeKey } from "@/lib/navigation";

export type NavBadgeCounts = Partial<Record<NavBadgeKey, number>>;

function mapQueueSummaryToBadges(summary: Awaited<ReturnType<typeof fetchWorkOrderQueueSummary>>): NavBadgeCounts {
  const byKey = new Map(summary.queues.map((queue) => [queue.key, queue.count]));
  const s = summary.summary;

  return {
    "action-center": s?.actionRequired ?? byKey.get("action-required") ?? 0,
    "my-tasks": s?.myTasks ?? byKey.get("my-tasks") ?? 0,
    "waiting-parts": s?.waitingParts ?? byKey.get("waiting-parts") ?? 0,
    "waiting-evidence": s?.waitingEvidence ?? byKey.get("waiting-evidence") ?? 0,
    "supervisor-verification": s?.supervisorVerification ?? byKey.get("supervisor-verification") ?? 0,
    "high-risk": s?.highRisk ?? byKey.get("high-risk") ?? 0,
    triage: s?.triage ?? byKey.get("triage") ?? 0,
    overdue: s?.overdue ?? byKey.get("overdue") ?? 0
  };
}

export function useNavBadges(enabled: boolean) {
  const query = useQuery({
    queryKey: ["navigation", "badges"],
    queryFn: async () => mapQueueSummaryToBadges(await fetchWorkOrderQueueSummary()),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (isDatabaseUnavailableError(error)) {
        return false;
      }
      return failureCount < 1;
    },
    refetchInterval: (q) => (q.state.error ? false : 120_000)
  });

  return {
    badges: query.data ?? {},
    isLoading: query.isLoading,
    hasError: query.isError
  };
}
