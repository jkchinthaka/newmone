"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Loader2 } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { humanWorkOrderStatusLabel } from "@/components/work-orders/helpers";

type MyJob = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  asset?: { name?: string; assetTag?: string } | null;
  functionalLocation?: { name?: string; code?: string } | null;
  site?: { name?: string } | null;
};

export default function MyJobsPage() {
  const [items, setItems] = useState<MyJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Prefer my-tasks queue; fall back to list filter
      const response = await apiClient.get("/work-orders/queues/my-tasks", {
        params: { pageSize: 50 }
      });
      const payload = response.data as {
        data?: { data?: MyJob[]; items?: MyJob[] } | MyJob[];
      };
      const raw = payload.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.items)
            ? raw.items
            : [];
      setItems(list);
    } catch (err) {
      try {
        const fallback = await apiClient.get("/work-orders", {
          params: { page: 1, pageSize: 50, myAssignedOnly: true }
        });
        const envelope = fallback.data as { data?: MyJob[] | { items?: MyJob[] } };
        const data = envelope.data;
        const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        setItems(list);
      } catch (fallbackErr) {
        setError(getApiErrorMessage(fallbackErr ?? err, "Unable to load my jobs."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs />
      <ResponsivePageHeader
        title="My Jobs"
        description="Technician work queue — acknowledge, start, complete."
        actions={
          <Link
            href={"/work-orders" as Route}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm"
          >
            All Work Orders
          </Link>
        }
      />

      {error ? <ErrorState title="Failed to load" description={error} /> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" size={16} /> Loading jobs…
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="text-sm text-slate-500">No assigned jobs right now.</p>
      ) : null}

      <div className="grid gap-3 md:hidden">
        {items.map((job) => (
          <Link
            key={job.id}
            href={`/work-orders?open=${job.id}` as Route}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-slate-900">{job.woNumber}</div>
              <span className="text-xs font-medium uppercase text-slate-500">{job.priority}</span>
            </div>
            <div className="mt-1 text-sm text-slate-700">
              {job.asset
                ? `${job.asset.name}${job.asset.assetTag ? ` (${job.asset.assetTag})` : ""}`
                : job.functionalLocation?.name || job.site?.name || job.title}
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>{humanWorkOrderStatusLabel(job.status)}</span>
              <span className="text-slate-500">
                {job.dueDate ? `Due ${new Date(job.dueDate).toLocaleDateString()}` : "No due date"}
              </span>
            </div>
            <div className="mt-3 text-sm font-medium text-brand-700">Open Job</div>
          </Link>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">WO</th>
              <th className="px-4 py-3">Asset / Location</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {items.map((job) => (
              <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/work-orders?open=${job.id}` as Route} className="font-medium text-brand-700">
                    {job.woNumber}
                  </Link>
                  <div className="text-xs text-slate-500">{job.title}</div>
                </td>
                <td className="px-4 py-3">
                  {job.asset?.name || job.functionalLocation?.name || "—"}
                </td>
                <td className="px-4 py-3">{job.priority}</td>
                <td className="px-4 py-3">{humanWorkOrderStatusLabel(job.status)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
