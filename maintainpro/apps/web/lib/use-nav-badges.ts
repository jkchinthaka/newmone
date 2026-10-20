"use client";

import { useQuery } from "@tanstack/react-query";
import { isDatabaseUnavailableError } from "@/lib/api-client";
import { fetchApprovalInbox } from "@/lib/approvals-api";
import { fetchWorkOrderQueueSummary } from "@/lib/work-order-queues-api";
import type { NavBadgeKey } from "@/lib/navigation";
import { withTenantScope } from "@/lib/tenant-query";

export type NavBadgeCounts = Partial<Record<NavBadgeKey, number>>;

// Keep this aligned with WorkOrdersController.queueSummary @Roles. Navigation
// exists for additional roles (for example DRIVER and CLEANER), but merely
// rendering that navigation must not trigger a guaranteed 403.
const APPROVAL_BADGE_ROLES = new Set([
  "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "SUPERVISOR",
  "ASSET_MANAGER", "FACILITY_MANAGER", "FINANCE", "VIEWER"
]);

const WORK_ORDER_QUEUE_SUMMARY_ROLES = new Set([
  "SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER",
  "FLEET_MANAGER", "COMPLIANCE_MANAGER", "FACILITY_MANAGER", "BUILDING_SUPERVISOR",
  "MECHANIC", "TECHNICIAN", "SUPERVISOR", "INVENTORY_KEEPER", "SECURITY_OFFICER",
  "VIEWER", "FINANCE"
]);

const APPROVAL_BADGE_PERMISSIONS = ["approvals.view", "approvals.decide", "approvals.rule.manage", "work_orders.manage"];

export function canFetchApprovalBadge(
  roleName: string | null | undefined,
  permissions?: readonly string[] | null
): boolean {
  if (!roleName || !APPROVAL_BADGE_ROLES.has(roleName)) return false;
  return (permissions ?? []).some((permission) => APPROVAL_BADGE_PERMISSIONS.includes(permission));
}

export function canRoleFetchNavBadges(roleName: string | null | undefined): boolean {
  return Boolean(roleName && WORK_ORDER_QUEUE_SUMMARY_ROLES.has(roleName));
}

function mapQueueSummaryToBadges(summary: Awaited<ReturnType<typeof fetchWorkOrderQueueSummary>>): NavBadgeCounts {
  const byKey = new Map(summary.queues.map((queue) => [queue.key, queue.count]));
  const s = summary.summary;

  return {
    "my-tasks": s?.myTasks ?? byKey.get("my-tasks") ?? 0,
    "waiting-parts": s?.waitingParts ?? byKey.get("waiting-parts") ?? 0,
    "waiting-evidence": s?.waitingEvidence ?? byKey.get("waiting-evidence") ?? 0,
    "supervisor-verification": s?.supervisorVerification ?? byKey.get("supervisor-verification") ?? 0,
    "high-risk": s?.highRisk ?? byKey.get("high-risk") ?? 0,
    triage: s?.triage ?? byKey.get("triage") ?? 0,
    overdue: s?.overdue ?? byKey.get("overdue") ?? 0
  };
}

export function useNavBadges(enabled: boolean, roleName?: string | null, permissions?: readonly string[] | null) {
  const approvals = useQuery({
    queryKey: withTenantScope(["approvals", "inbox-count"]),
    queryFn: () => fetchApprovalInbox({ page: 1, pageSize: 1 }),
    select: (data) => data.meta.counts?.all ?? data.meta.total ?? 0,
    enabled: enabled && canFetchApprovalBadge(roleName, permissions),
    staleTime: 30_000,
    retry: false
  });

  const query = useQuery({
    queryKey: withTenantScope(["work-orders", "queue-summary", ""]),
    queryFn: () => fetchWorkOrderQueueSummary(),
    select: mapQueueSummaryToBadges,
    enabled: enabled && canRoleFetchNavBadges(roleName),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (isDatabaseUnavailableError(error)) {
        return false;
      }
      return failureCount < 1;
    },
    refetchInterval: (q) => (q.state.error ? false : 120_000)
  });

  return {
    badges: { ...(query.data ?? {}), approvals: approvals.data },
    isLoading: query.isLoading,
    hasError: query.isError
  };
}
