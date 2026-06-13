import { fetchWorkOrders } from "@/components/work-orders/api";
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
  actionCenterShowsInvitations,
  actionCenterShowsInventory,
  actionCenterShowsSystemHealth,
  actionCenterShowsWorkOrders,
  type ActionCenterSnapshot,
  type ActionCenterVariant
} from "./action-center";
import { computeWorkOrderDashboardStats } from "./dashboard-roles";

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

type ApiEnvelope<T> = {
  data: T;
};

export type FetchActionCenterOptions = {
  variant: ActionCenterVariant;
  roleName: string | null;
  userId: string | null;
};

export async function fetchActionCenterSnapshot(
  options: FetchActionCenterOptions
): Promise<ActionCenterSnapshot> {
  const { variant, roleName, userId } = options;

  const snapshot: ActionCenterSnapshot = {
    variant,
    roleName,
    connections: {
      workOrders: false,
      inventory: false,
      systemHealth: false,
      invitations: false,
      facilityIssues: false
    }
  };

  const tasks: Promise<void>[] = [];

  if (actionCenterShowsWorkOrders(variant)) {
    tasks.push(
      fetchWorkOrders()
        .then((orders) => {
          const assignedUserId = variant === "technician" ? userId : null;
          const stats = computeWorkOrderDashboardStats(orders, { assignedUserId });
          const highPriority = orders.filter(
            (order) =>
              order.status !== "COMPLETED" &&
              order.status !== "CANCELLED" &&
              (order.priority === "HIGH" || order.priority === "CRITICAL") &&
              (assignedUserId == null || order.technicianId === assignedUserId)
          ).length;

          snapshot.workOrders = {
            open: stats.open,
            inProgress: stats.inProgress,
            overdue: stats.overdue,
            highPriority,
            assigned: assignedUserId != null ? stats.total : undefined
          };
          snapshot.connections.workOrders = true;
        })
        .catch(() => {
          snapshot.workOrders = null;
        })
    );
  }

  if (actionCenterShowsInventory(variant)) {
    tasks.push(
      Promise.all([getInventoryParts(), getLowStockParts(), getPurchaseOrders()])
        .then(([parts, lowStock, purchaseOrders]) => {
          const summary = calculateSummary(parts, purchaseOrders);
          snapshot.inventory = {
            lowStockCount: lowStock.length,
            criticalCount: summary.criticalCount,
            pendingPurchaseOrders: summary.pendingPurchaseOrders
          };
          snapshot.connections.inventory = true;
        })
        .catch(() => {
          snapshot.inventory = null;
        })
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
        .catch(() => {
          snapshot.systemHealth = null;
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
        .catch(() => {
          snapshot.invitations = null;
        })
    );
  }

  if (actionCenterShowsFacilityIssues(variant, roleName)) {
    tasks.push(
      apiClient
        .get<ApiEnvelope<FacilityIssueRow[]>>("/cleaning/issues")
        .then((response) => {
          const rows = response.data.data ?? [];
          snapshot.facilityIssues = {
            open: rows.filter((row) => row.status === "OPEN" || row.status === "IN_PROGRESS").length,
            inProgress: rows.filter((row) => row.status === "IN_PROGRESS").length,
            critical: rows.filter(
              (row) =>
                row.severity === "CRITICAL" &&
                row.status !== "RESOLVED" &&
                row.status !== "CLOSED"
            ).length
          };
          snapshot.connections.facilityIssues = true;
        })
        .catch(() => {
          snapshot.facilityIssues = null;
        })
    );
  }

  await Promise.all(tasks);
  return snapshot;
}
