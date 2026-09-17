"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type WorkPermit = {
  id: string;
  permitNumber: string;
  permitType: string;
  status: string;
  workOrderId: string;
  validFrom: string | null;
  validTo: string | null;
  notes: string | null;
};

const PERMIT_TYPES = [
  "ELECTRICAL",
  "HOT_WORK",
  "CONFINED_SPACE",
  "WORKING_AT_HEIGHT",
  "HIGH_RISK_MACHINERY",
  "OTHER"
];

export default function AdminWorkPermitsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    workOrderId: "",
    permitType: "ELECTRICAL",
    validTo: "",
    notes: ""
  });

  const listQuery = useQuery({
    queryKey: withTenantScope(["admin", "work-permits"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: WorkPermit[] }>("/work-permits");
      return res.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/work-permits", {
        workOrderId: form.workOrderId,
        permitType: form.permitType,
        validTo: form.validTo || undefined,
        notes: form.notes || undefined
      });
    },
    onSuccess: () => {
      toast.success("Permit created");
      setForm((f) => ({ ...f, workOrderId: "", notes: "" }));
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "work-permits"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Create failed"))
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiClient.patch(`/work-permits/${id}/status`, { status });
    },
    onSuccess: () => {
      toast.success("Permit updated");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "work-permits"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Update failed"))
  });

  if (listQuery.isLoading) {
    return <LoadingState title="Loading permits" description="Fetching work permits." />;
  }
  if (listQuery.isError) {
    return (
      <ErrorState
        title="Unable to load permits"
        description={getApiErrorMessage(listQuery.error, "Request failed")}
        onRetry={() => listQuery.refetch()}
      />
    );
  }

  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Maintenance config", href: "/admin/maintenance-config" },
          { label: "Work permits" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Permit-to-Work</h1>
        <p className="mt-1 text-sm text-slate-600">
          Issue and approve permits. Critical-asset work orders cannot start without a valid permit when
          policy requires it.
        </p>
      </div>

      <div className="grid max-w-xl gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Work order ID"
          value={form.workOrderId}
          onChange={(e) => setForm((f) => ({ ...f, workOrderId: e.target.value }))}
        />
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={form.permitType}
          onChange={(e) => setForm((f) => ({ ...f, permitType: e.target.value }))}
        >
          {PERMIT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={form.validTo}
          onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
        />
        <textarea
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          rows={2}
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
        <button
          type="button"
          className="w-fit rounded bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={!form.workOrderId || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Create draft permit
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">WO</th>
              <th className="px-3 py-2">Valid to</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{row.permitNumber}</td>
                <td className="px-3 py-2">{row.permitType}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.workOrderId.slice(0, 10)}…</td>
                <td className="px-3 py-2">
                  {row.validTo ? new Date(row.validTo).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.status === "DRAFT" ? (
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => statusMutation.mutate({ id: row.id, status: "APPROVED" })}
                      >
                        Approve
                      </button>
                    ) : null}
                    {row.status === "APPROVED" ? (
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => statusMutation.mutate({ id: row.id, status: "ACTIVE" })}
                      >
                        Activate
                      </button>
                    ) : null}
                    {["APPROVED", "ACTIVE"].includes(row.status) ? (
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => statusMutation.mutate({ id: row.id, status: "CLOSED" })}
                      >
                        Close
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No permits yet.</p>
        ) : null}
      </div>
    </div>
  );
}
