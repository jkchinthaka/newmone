"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { fetchEntityAudit, type AuditEntry } from "@/lib/audit-api";
import { getApiErrorMessage } from "@/lib/api-client";
import { canViewAuditHistoryForUser, useCurrentUser } from "@/lib/use-current-user";

const AUDIT_EVENT_LABELS: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  APPROVE: "Approved",
  REJECT: "Rejected",
  ASSIGN: "Assigned",
  STATUS_CHANGE: "Status updated",
  SUBMIT: "Submitted for approval",
  work_order_created: "Work order created",
  work_order_assigned: "Technician assigned",
  work_order_submitted_for_approval: "Submitted for approval",
  work_order_approved: "Approved",
  work_order_rejected: "Rejected",
  work_order_status_updated: "Status changed",
  work_order_technician_completed: "Technician completed",
  work_order_supervisor_verified: "Supervisor verified",
  work_order_supervisor_rejected: "Supervisor rejected",
  work_order_closed: "Closed",
  work_order_cancelled: "Cancelled",
  work_order_reopened: "Reopened",
  work_order_assignee_removed: "Assignee removed",
  work_order_schedule_updated: "Schedule updated",
  work_order_edited_after_completion: "Edited after completion"
};

type Props = {
  workOrderId: string;
};

function formatAuditAction(entry: AuditEntry) {
  const metadataEvent =
    entry.metadata &&
    typeof entry.metadata === "object" &&
    !Array.isArray(entry.metadata) &&
    "event" in entry.metadata
      ? String((entry.metadata as Record<string, unknown>).event)
      : null;

  const metadataAction =
    entry.afterData &&
    typeof entry.afterData === "object" &&
    !Array.isArray(entry.afterData) &&
    "action" in entry.afterData
      ? String((entry.afterData as Record<string, unknown>).action)
      : null;

  return (
    (metadataEvent && AUDIT_EVENT_LABELS[metadataEvent]) ||
    AUDIT_EVENT_LABELS[entry.action] ||
    metadataAction ||
    entry.action
  );
}

function actorLabel(entry: AuditEntry) {
  if (!entry.actor) return "System";
  const name = [entry.actor.firstName, entry.actor.lastName].filter(Boolean).join(" ").trim();
  return name || entry.actor.email || "User";
}

export function WorkOrderAuditPanel({ workOrderId }: Props) {
  const user = useCurrentUser();
  const canView = canViewAuditHistoryForUser(user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!canView || !workOrderId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const workOrderAudit = await fetchEntityAudit("WorkOrder", workOrderId, 1, 50);

        if (!cancelled) {
          setEntries(workOrderAudit.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Could not load audit history."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [canView, workOrderId]);

  if (!canView) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Audit history is available to administrators and users with audit.view permission.
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <div className="inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Loading audit events…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</section>
    );
  }

  const combined = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-700" aria-hidden />
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Audit trail</h4>
          <p className="mt-1 text-xs text-slate-500">
            Immutable change log for this work order and assignee changes. Some lifecycle events may only appear when
            captured by domain audit middleware.
          </p>
        </div>
      </div>

      {combined.length === 0 ? (
        <p className="text-sm text-slate-500">No audit events recorded for this work order yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {combined.map((entry) => (
            <li key={entry.id} className="px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-900">{formatAuditAction(entry)}</span>
                <span className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {entry.entity}
                {entry.entity === "WorkOrderAssignee" ? " assignee change" : ""} · {actorLabel(entry)}
                {entry.reason ? ` · Reason: ${entry.reason}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
