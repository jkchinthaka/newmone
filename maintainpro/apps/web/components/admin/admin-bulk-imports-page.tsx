"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, History, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { PermissionState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  type BulkImportEntitySlug,
  type BulkImportRun,
  downloadBulkImportErrors,
  fetchBulkImportHistory,
  triggerBlobDownload
} from "@/lib/bulk-import-api";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

const STATUS_TONE: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  FAILED: "bg-rose-50 text-rose-700",
  BLOCKED: "bg-slate-100 text-slate-600",
  VALIDATED: "bg-blue-50 text-blue-700",
  COMMITTING: "bg-blue-50 text-blue-700",
  UPLOADED: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-slate-100 text-slate-500"
};

const ENTITY_LABEL: Record<string, string> = {
  VEHICLE: "Vehicle",
  ASSET: "Asset",
  DEPARTMENT: "Department",
  SUPPLIER: "Supplier",
  JOB_CODE: "Job Code"
};

function toEntitySlug(entityType: string): BulkImportEntitySlug {
  return entityType.toLowerCase().replace(/_/g, "-") as BulkImportEntitySlug;
}

export function AdminBulkImportsPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isSuperAdmin = roleName === "SUPER_ADMIN";

  const [items, setItems] = useState<BulkImportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBulkImportHistory({ pageSize: 50 });
      setItems(result.items);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void refresh();
  }, [isSuperAdmin, refresh]);

  if (!isSuperAdmin) {
    return (
      <div className="space-y-5 p-6">
        <PageBreadcrumbs />
        <PermissionState
          title="SUPER_ADMIN access required"
          description="Bulk import history is only visible to SUPER_ADMIN. Backend authorization independently enforces this regardless of what this page shows."
        />
      </div>
    );
  }

  async function handleDownloadErrors(run: BulkImportRun) {
    try {
      const blob = await downloadBulkImportErrors(toEntitySlug(run.entityType), run.id);
      triggerBlobDownload(blob, `bulk-import-${run.id}-errors.csv`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Unable to download the error report"));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumbs />
      <header className="flex items-center gap-3">
        <span className="rounded-xl bg-brand-50 p-2 text-brand-600">
          <History size={20} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Bulk Import History</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every master-data bulk import run for your tenant — file, actor, counts, status, and error downloads.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12 text-sm text-slate-400">
            <Loader2 size={16} className="mr-2 animate-spin" aria-hidden /> Loading…
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">{getApiErrorMessage(error, "Unable to load bulk import history")}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No bulk imports yet. Use the Bulk Upload button on a supported master-data page (Vehicles, Assets,
            Departments, Suppliers, Job Codes) to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2">Entity</th>
                  <th className="px-5 py-2">File</th>
                  <th className="px-5 py-2">Actor</th>
                  <th className="px-5 py-2">Date</th>
                  <th className="px-5 py-2">Created</th>
                  <th className="px-5 py-2">Updated</th>
                  <th className="px-5 py-2">Skipped</th>
                  <th className="px-5 py-2">Failed</th>
                  <th className="px-5 py-2">Status</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((run) => (
                  <tr key={run.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">{ENTITY_LABEL[run.entityType] ?? run.entityType}</td>
                    <td className="px-5 py-3 text-slate-600">{run.originalFilename}</td>
                    <td className="px-5 py-3 text-slate-500">{run.actorEmail}</td>
                    <td className="px-5 py-3 text-slate-500">{new Date(run.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3 text-emerald-700">{run.createCount}</td>
                    <td className="px-5 py-3 text-blue-700">{run.updateCount}</td>
                    <td className="px-5 py-3 text-amber-700">{run.skipCount}</td>
                    <td className="px-5 py-3 text-rose-700">{run.errorCount}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[run.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {run.errorCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => void handleDownloadErrors(run)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                        >
                          <Download size={12} aria-hidden /> Errors
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
