"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { extractRoleName } from "@/lib/role-redirect";
import {
  listMaintenanceRequests,
  type MaintenanceRequestListItem
} from "@/lib/maintenance-requests-api";

const TRIAGE_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "ASSET_MANAGER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR"
]);

export default function RequestsPage() {
  const user = useCurrentUser();
  const role = extractRoleName({ role: user.role });
  const canTriage = role != null && TRIAGE_ROLES.has(role);

  const [items, setItems] = useState<MaintenanceRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState(!canTriage);
  const [triageQueue, setTriageQueue] = useState(false);
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listMaintenanceRequests({
        mine: mine || undefined,
        triageQueue: triageQueue || undefined,
        status: status || undefined,
        limit: 50
      });
      setItems(result.items);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load requests."));
    } finally {
      setLoading(false);
    }
  }, [mine, triageQueue, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs />
      <ResponsivePageHeader
        title="Maintenance Requests"
        description="Report issues, track status, and triage before Work Order conversion."
        actions={
          <Link
            href={"/requests/new" as Route}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white"
          >
            <Plus size={16} /> Report Issue
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`min-h-11 rounded-lg px-3 text-sm ${mine ? "bg-brand-50 text-brand-900" : "border border-slate-200"}`}
          onClick={() => {
            setMine(true);
            setTriageQueue(false);
          }}
        >
          My Requests
        </button>
        {canTriage ? (
          <button
            type="button"
            className={`min-h-11 rounded-lg px-3 text-sm ${triageQueue ? "bg-brand-50 text-brand-900" : "border border-slate-200"}`}
            onClick={() => {
              setTriageQueue(true);
              setMine(false);
            }}
          >
            Triage Queue
          </button>
        ) : null}
        <select
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="CONVERTED_TO_WO">Converted</option>
        </select>
      </div>

      {error ? <ErrorState title="Failed to load" description={error} /> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="text-sm text-slate-500">No requests found.</p>
      ) : null}

      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/requests/${item.id}` as Route}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-slate-900">{item.requestNumber}</div>
              <span className="text-xs font-medium uppercase text-slate-500">{item.priority}</span>
            </div>
            <div className="mt-1 text-sm text-slate-700">
              {item.asset ? `${item.asset.name} (${item.asset.assetTag})` : item.functionalLocation?.name || "Location"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {item.site?.name}
              {item.functionalLocation ? ` / ${item.functionalLocation.name}` : ""}
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>{item.statusLabel}</span>
              <span className="text-slate-500">
                {new Date(item.reportedAt).toLocaleString()}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Request</th>
              <th className="px-4 py-3">Asset / Location</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reported</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/requests/${item.id}` as Route} className="font-medium text-brand-700">
                    {item.requestNumber}
                  </Link>
                  <div className="line-clamp-1 text-xs text-slate-500">{item.description}</div>
                </td>
                <td className="px-4 py-3">
                  {item.asset ? (
                    <div>
                      {item.asset.name}
                      <div className="text-xs text-slate-500">{item.asset.assetTag}</div>
                    </div>
                  ) : (
                    item.functionalLocation?.name || "—"
                  )}
                </td>
                <td className="px-4 py-3">{item.priority}</td>
                <td className="px-4 py-3">{item.statusLabel}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(item.reportedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
