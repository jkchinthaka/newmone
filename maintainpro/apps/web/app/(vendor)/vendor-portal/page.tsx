"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type VendorJob = {
  id: string;
  status: string;
  workOrder: {
    id: string;
    number: string | null;
    title: string;
    status: string;
    priority: string;
    problem: string;
  } | null;
  quotations: Array<{ id: string; quotationNo: string; quotedAmount: number; status: string }>;
};

export default function VendorPortalJobsPage() {
  const qc = useQueryClient();
  const [quote, setQuote] = useState({ caseId: "", quotationNo: "", quotedAmount: "" });

  const jobsQuery = useQuery({
    queryKey: withTenantScope(["vendor-portal", "jobs"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: VendorJob[] }>("/vendor-portal/jobs");
      return res.data.data;
    }
  });

  const quoteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/vendor-portal/jobs/${quote.caseId}/quotations`, {
        quotationNo: quote.quotationNo,
        quotedAmount: Number(quote.quotedAmount)
      });
    },
    onSuccess: () => {
      toast.success("Quotation submitted");
      setQuote({ caseId: "", quotationNo: "", quotedAmount: "" });
      void qc.invalidateQueries({ queryKey: withTenantScope(["vendor-portal", "jobs"]) });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Submit failed"))
  });

  const progressMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiClient.patch(`/vendor-portal/jobs/${id}/progress`, { status });
    },
    onSuccess: () => {
      toast.success("Progress updated");
      void qc.invalidateQueries({ queryKey: withTenantScope(["vendor-portal", "jobs"]) });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Update failed"))
  });

  if (jobsQuery.isLoading) {
    return <LoadingState title="Vendor portal" description="Loading assigned jobs." />;
  }
  if (jobsQuery.isError) {
    return (
      <ErrorState
        title="Unable to load vendor jobs"
        description={getApiErrorMessage(jobsQuery.error, "Access may be missing")}
        onRetry={() => jobsQuery.refetch()}
      />
    );
  }

  const jobs = jobsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <PageBreadcrumbs items={[{ label: "Vendor portal" }, { label: "Assigned jobs" }]} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Assigned jobs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Only jobs explicitly assigned to your vendor account are visible. Internal costs and notes are
          hidden.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-4">
        <input
          className="rounded border px-3 py-2 text-sm sm:col-span-2"
          placeholder="Case ID"
          value={quote.caseId}
          onChange={(e) => setQuote((q) => ({ ...q, caseId: e.target.value }))}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Quotation no"
          value={quote.quotationNo}
          onChange={(e) => setQuote((q) => ({ ...q, quotationNo: e.target.value }))}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Amount"
          value={quote.quotedAmount}
          onChange={(e) => setQuote((q) => ({ ...q, quotedAmount: e.target.value }))}
        />
        <button
          type="button"
          className="rounded bg-brand-600 px-3 py-2 text-sm text-white sm:col-span-4 sm:w-fit"
          disabled={!quote.caseId || !quote.quotationNo || quoteMutation.isPending}
          onClick={() => quoteMutation.mutate()}
        >
          Submit quotation
        </button>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {job.workOrder?.number ?? job.workOrder?.id.slice(0, 8)} — {job.workOrder?.title}
                </p>
                <p className="text-sm text-slate-600">{job.workOrder?.problem}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Case {job.id.slice(0, 10)}… · {job.status} · WO {job.workOrder?.status}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => progressMutation.mutate({ id: job.id, status: "IN_VENDOR_REPAIR" })}
                >
                  Start repair
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => progressMutation.mutate({ id: job.id, status: "VENDOR_COMPLETED" })}
                >
                  Complete
                </button>
              </div>
            </div>
            {(job.quotations?.length ?? 0) > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                {job.quotations.map((q) => (
                  <li key={q.id}>
                    {q.quotationNo}: {q.quotedAmount} ({q.status})
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No assigned jobs for this vendor account.</p>
        ) : null}
      </div>
    </div>
  );
}
