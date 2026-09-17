"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { fetchErpExceptions } from "@/lib/erp-api";
import { withTenantScope } from "@/lib/tenant-query";

type ExceptionItem = {
  id: string;
  source: string;
  target: string;
  entity: string;
  entityId: string;
  operation: string;
  status: string;
  attemptCount: number;
  lastError: string;
  errorCode: string | null;
  correlationId: string | null;
  timestamp: string;
  retryPath: string | null;
};

export default function ErpExceptionsPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: withTenantScope(["erp", "exceptions"]),
    queryFn: () => fetchErpExceptions(100)
  });

  const retryMutation = useMutation({
    mutationFn: async (item: ExceptionItem) => {
      if (!item.retryPath || !item.retryPath.includes("erp-sync/retry")) {
        throw new Error("Retry not available for this exception type");
      }
      await apiClient.post(item.retryPath, { note: "Retry from ERP exception center" });
    },
    onSuccess: () => {
      toast.success("Retry submitted");
      void qc.invalidateQueries({ queryKey: withTenantScope(["erp", "exceptions"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Retry failed"))
  });

  if (query.isLoading) {
    return <LoadingState title="Loading exceptions" description="ERP sync failures and mismatches." />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load exceptions"
        description={getApiErrorMessage(query.error, "Request failed")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data!;
  const items = (data.items ?? []) as ExceptionItem[];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs items={[{ label: "ERP", href: "/erp" }, { label: "Exceptions" }]} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">ERP sync exception center</h1>
        <p className="mt-1 text-sm text-slate-600">
          Failed integrations, import failures, and open reconciliation mismatches. Secrets are never shown.
        </p>
        {data.note ? <p className="mt-2 text-xs text-amber-800">{data.note}</p> : null}
      </div>

      <p className="text-sm text-slate-500">{data.count} exception(s)</p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Error</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.source}-${item.id}`} className="border-b last:border-0 align-top">
                <td className="px-3 py-2">
                  <div className="font-medium">{item.source}</div>
                  <div className="text-xs text-slate-500">{item.operation}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {item.entity}
                  <br />
                  {item.entityId.slice(0, 12)}…
                  {item.correlationId ? (
                    <>
                      <br />
                      corr:{String(item.correlationId).slice(0, 16)}
                    </>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-700">{item.lastError}</td>
                <td className="px-3 py-2">{item.attemptCount}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2">
                  {item.retryPath?.includes("erp-sync/retry") ? (
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs"
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate(item)}
                    >
                      Retry
                    </button>
                  ) : item.retryPath ? (
                    <a className="text-xs text-brand-700 underline" href={item.retryPath}>
                      Investigate
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No open ERP exceptions.</p>
        ) : null}
      </div>
    </div>
  );
}
