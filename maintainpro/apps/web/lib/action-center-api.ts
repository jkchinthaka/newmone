import { fetchWorkOrderQueueSummary, type WorkOrderQueueKey } from "@/lib/work-order-queues-api";
import {
  getInventoryParts,
  getLowStockParts,
  getPurchaseOrders
} from "@/components/inventory/api";
import { calculateSummary } from "@/components/inventory/helpers";

import { fetchAdminInvitationReviewList } from "./admin-invitations-api";
import { apiClient } from "./api-client";
import {
  actionCenterShowsFacilityIssues,
  actionCenterShowsFinanceSignals,
  actionCenterShowsInvitations,
  actionCenterShowsInventory,
  resolveActionCenterInventoryAccess,
  actionCenterShowsSystemHealth,
  actionCenterShowsWorkOrders,
  resolveFacilityIssuesSource,
  type ActionCenterErrorKind,
  type ActionCenterSnapshot,
  type ActionCenterVariant
} from "./action-center";

type SystemHealthPayload = {
  status: "operational" | "degraded";
  summary: {
    operational: number;
    degraded: number;
    failed: number;
    required: number;
  };
};

type FacilityIssueRow = {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
};

type FacilityDashboardIssuesSummary = {
  openIssueCount: number;
  inProgressIssueCount: number;
  criticalOpenIssueCount: number;
};

type ApiEnvelope<T> = {
  data: T;
};

export type FetchActionCenterOptions = {
  variant: ActionCenterVariant;
  roleName: string | null;
  userId: string | null;
  permissions?: readonly string[];
};

/**
 * Classifies a failed request without leaking response bodies/headers into the
 * UI. This lets a section distinguish "your role can't see this" (retrying
 * won't help — and the section shouldn't keep quietly re-requesting it every
 * 60s) from "this is temporarily down" (retrying is exactly the right call).
 */
function classifyActionCenterError(error: unknown): ActionCenterErrorKind {
  const status = (error as { response?: { status?: number } } | null | undefined)?.response?.status;
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404 || status === 501) return "unavailable";
  if (typeof status === "number" && status >= 500) return "server";
  if (status === undefined) return "network";
  return "unknown";
}

function queueCount(
  queues: Array<{ key: WorkOrderQueueKey; count: number }>,
  key: WorkOrderQueueKey
): number {
  return queues.find((entry) => entry.key === key)?.count ?? 0;
}

export async function fetchActionCenterSnapshot(
  options: FetchActionCenterOptions
): Promise<ActionCenterSnapshot> {
  const { variant, roleName, userId, permissions } = options;
  void userId; // work-order queue summary is already actor-scoped server-side for "my-tasks"

  const snapshot: ActionCenterSnapshot = {
    variant,
    roleName,
    permissions,
    connections: {
      workOrders: false,
      inventory: false,
      systemHealth: false,
      invitations: false,
      facilityIssues: false
    },
    errors: {}
  };

  const tasks: Promise<void>[] = [];

  const needsWorkOrderSummary = actionCenterShowsWorkOrders(variant) || actionCenterShowsFinanceSignals(variant);
  if (needsWorkOrderSummary) {
    tasks.push(
      fetchWorkOrderQueueSummary()
        .then((queueSummary) => {
          const summary = queueSummary.summary;
          const isTechnician = variant === "technician";

          snapshot.workOrders = {
            open: queueCount(queueSummary.queues, "open-requests"),
            inProgress: queueCount(queueSummary.queues, "in-progress"),
            overdue: summary?.overdue ?? queueCount(queueSummary.queues, "overdue"),
            // Tenant-wide, not actor-scoped (the backend aggregate has no per-technician
            // priority breakdown). Left at 0 for technicians rather than showing a
            // tenant-wide number under a card labelled as if it were personal.
            highPriority: isTechnician ? 0 : summary?.highPriorityOpen ?? 0,
            assigned: isTechnician ? summary?.myTasks ?? queueCount(queueSummary.queues, "my-tasks") : undefined,
            financeVendorPending: queueCount(queueSummary.queues, "finance-vendor-pending")
          };
          snapshot.connections.workOrders = true;
        })
        .catch((error) => {
          snapshot.workOrders = null;
          snapshot.errors!.workOrders = classifyActionCenterError(error);
        })
    );
  }

  const inventoryAccess = resolveActionCenterInventoryAccess(roleName, permissions);
  if (actionCenterShowsInventory(variant, roleName, permissions)) {
    tasks.push(
      Promise.allSettled([
        inventoryAccess.stock ? getInventoryParts() : Promise.resolve(null),
        inventoryAccess.stock ? getLowStockParts() : Promise.resolve(null),
        inventoryAccess.purchaseOrders ? getPurchaseOrders() : Promise.resolve(null)
      ]).then(
        ([partsResult, lowStockResult, purchaseOrdersResult]) => {
          const stockOk =
            inventoryAccess.stock &&
            partsResult.status === "fulfilled" &&
            partsResult.value !== null &&
            lowStockResult.status === "fulfilled" &&
            lowStockResult.value !== null;
          const purchaseOrdersOk =
            inventoryAccess.purchaseOrders &&
            purchaseOrdersResult.status === "fulfilled" &&
            purchaseOrdersResult.value !== null;

          if (!stockOk && !purchaseOrdersOk) {
            snapshot.inventory = null;
            const failure =
              partsResult.status === "rejected"
                ? partsResult.reason
                : lowStockResult.status === "rejected"
                  ? lowStockResult.reason
                  : purchaseOrdersResult.status === "rejected"
                    ? purchaseOrdersResult.reason
                    : undefined;
            snapshot.errors!.inventory = classifyActionCenterError(failure);
            return;
          }

          const parts = stockOk ? partsResult.value! : [];
          const lowStock = stockOk ? lowStockResult.value! : [];
          const purchaseOrders = purchaseOrdersOk ? purchaseOrdersResult.value! : [];
          const summary = calculateSummary(parts, purchaseOrders);

          snapshot.inventory = {
            lowStockCount: stockOk ? lowStock.length : null,
            criticalCount: stockOk ? summary.criticalCount : null,
            pendingPurchaseOrders: purchaseOrdersOk ? summary.pendingPurchaseOrders : null
          };
          snapshot.connections.inventory = true;
          if ((inventoryAccess.stock && !stockOk) || (inventoryAccess.purchaseOrders && !purchaseOrdersOk)) {
            snapshot.errors!.inventory = "partial";
          }
        }
      )
    );
  }

  if (actionCenterShowsSystemHealth(variant)) {
    tasks.push(
      apiClient
        .get<ApiEnvelope<SystemHealthPayload>>("/health/readiness")
        .then((response) => {
          const health = response.data.data;
          snapshot.systemHealth = {
            status: health.status,
            failed: health.summary.failed,
            degraded: health.summary.degraded
          };
          snapshot.connections.systemHealth = true;
        })
        .catch((error) => {
          snapshot.systemHealth = null;
          snapshot.errors!.systemHealth = classifyActionCenterError(error);
        })
    );
  }

  if (actionCenterShowsInvitations(roleName)) {
    tasks.push(
      fetchAdminInvitationReviewList()
        .then((rows) => {
          snapshot.invitations = {
            pending: rows.filter((row) => row.status === "PENDING").length,
            expired: rows.filter((row) => row.status === "EXPIRED").length
          };
          snapshot.connections.invitations = true;
        })
        .catch((error) => {
          snapshot.invitations = null;
          snapshot.errors!.invitations = classifyActionCenterError(error);
        })
    );
  }

  // Facility/cleaning issue counts: call whichever backend endpoint this role is
  // actually authorized for (see resolveFacilityIssuesSource) instead of always
  // hitting /cleaning/issues, which most "management" roles get a 403 from.
  const facilitySource = resolveFacilityIssuesSource(roleName);
  if (facilitySource !== "none") {
    const request =
      facilitySource === "dashboard"
        ? apiClient
            .get<ApiEnvelope<{ issues: FacilityDashboardIssuesSummary }>>("/facilities/dashboard")
            .then((response) => {
              const issues = response.data.data.issues;
              return {
                open: issues.openIssueCount + issues.inProgressIssueCount,
                inProgress: issues.inProgressIssueCount,
                critical: issues.criticalOpenIssueCount
              };
            })
        : apiClient.get<ApiEnvelope<FacilityIssueRow[]>>("/cleaning/issues").then((response) => {
            const rows = response.data.data ?? [];
            return {
              open: rows.filter((row) => row.status === "OPEN" || row.status === "IN_PROGRESS").length,
              inProgress: rows.filter((row) => row.status === "IN_PROGRESS").length,
              critical: rows.filter(
                (row) =>
                  row.severity === "CRITICAL" && row.status !== "RESOLVED" && row.status !== "CLOSED"
              ).length
            };
          });

    tasks.push(
      request
        .then((facilityIssues) => {
          snapshot.facilityIssues = facilityIssues;
          snapshot.connections.facilityIssues = true;
        })
        .catch((error) => {
          snapshot.facilityIssues = null;
          snapshot.errors!.facilityIssues = classifyActionCenterError(error);
        })
    );
  }

  await Promise.all(tasks);
  return snapshot;
}
