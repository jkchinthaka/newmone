"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type Warranty = {
  id: string;
  subjectType: string;
  subjectId: string;
  provider: string;
  reference: string | null;
  startDate: string;
  endDate: string;
  status: string;
  policyAction: string;
  _count?: { claims: number };
};

type Claim = {
  id: string;
  claimNumber: string;
  status: string;
  claimAmount: string | number | null;
  recoveredAmount: string | number | null;
  warrantyId: string;
  workOrderId: string | null;
};

export default function AdminWarrantiesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"warranties" | "claims">("warranties");
  const [form, setForm] = useState({
    subjectType: "ASSET",
    subjectId: "",
    provider: "",
    reference: "",
    startDate: "",
    endDate: "",
    policyAction: "WARN"
  });

  const warrantiesQuery = useQuery({
    queryKey: withTenantScope(["admin", "warranties"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Warranty[] }>("/warranties");
      return res.data.data;
    }
  });

  const claimsQuery = useQuery({
    queryKey: withTenantScope(["admin", "warranty-claims"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Claim[] }>("/warranties/claims");
      return res.data.data;
    },
    enabled: tab === "claims"
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/warranties", {
        ...form,
        reason: "Warranty registered from admin"
      });
    },
    onSuccess: () => {
      toast.success("Warranty created");
      setForm((f) => ({ ...f, subjectId: "", provider: "", reference: "" }));
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "warranties"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Create failed"))
  });

  const claimMutation = useMutation({
    mutationFn: async (warrantyId: string) => {
      await apiClient.post("/warranties/claims", {
        warrantyId,
        reason: "Claim opened from admin"
      });
    },
    onSuccess: () => {
      toast.success("Claim created");
      setTab("claims");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "warranty-claims"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Claim failed"))
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiClient.patch(`/warranties/claims/${id}/status`, {
        status,
        reason: `Transition to ${status}`
      });
    },
    onSuccess: () => {
      toast.success("Claim updated");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "warranty-claims"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Update failed"))
  });

  if (warrantiesQuery.isLoading) {
    return <LoadingState title="Loading warranties" description="Fetching coverage records." />;
  }

  if (warrantiesQuery.isError) {
    return (
      <ErrorState
        title="Unable to load warranties"
        description={getApiErrorMessage(warrantiesQuery.error, "Request failed")}
        onRetry={() => warrantiesQuery.refetch()}
      />
    );
  }

  const warranties = warrantiesQuery.data ?? [];
  const claims = claimsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Maintenance Configuration", href: "/admin/maintenance-config" },
          { label: "Warranties" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Warranties & Recovery</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track coverage on assets, vehicles, and parts. Work orders flag UNDER WARRANTY when an
          active policy applies. Claims follow ELIGIBLE → … → RECOVERED / CLOSED.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("warranties")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "warranties" ? "bg-brand-600 text-white" : "border border-slate-200 bg-white"
          }`}
        >
          Warranties
        </button>
        <button
          type="button"
          onClick={() => setTab("claims")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "claims" ? "bg-brand-600 text-white" : "border border-slate-200 bg-white"
          }`}
        >
          Claims
        </button>
      </div>

      {tab === "warranties" ? (
        <>
          <form
            className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div>
              <label className="text-xs font-medium text-slate-500" htmlFor="subjectType">
                Subject type
              </label>
              <select
                id="subjectType"
                value={form.subjectType}
                onChange={(e) => setForm((f) => ({ ...f, subjectType: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {["ASSET", "VEHICLE", "MACHINE", "TYRE", "BATTERY", "SPARE_PART", "VENDOR_REPAIR"].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500" htmlFor="subjectId">
                Subject ID
              </label>
              <input
                id="subjectId"
                required
                value={form.subjectId}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Asset / vehicle / part id"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500" htmlFor="provider">
                Provider
              </label>
              <input
                id="provider"
                required
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500" htmlFor="reference">
                Reference
              </label>
              <input
                id="reference"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500" htmlFor="startDate">
                Start
              </label>
              <input
                id="startDate"
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500" htmlFor="endDate">
                End
              </label>
              <input
                id="endDate"
                type="date"
                required
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Create warranty
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Window</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Policy</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warranties.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.subjectType}</div>
                      <div className="font-mono text-xs text-slate-500">{row.subjectId}</div>
                    </td>
                    <td className="px-4 py-3">
                      {row.provider}
                      {row.reference ? (
                        <div className="text-xs text-slate-500">{row.reference}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {new Date(row.startDate).toLocaleDateString()} –{" "}
                      {new Date(row.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">{row.policyAction}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-brand-700 underline"
                        disabled={claimMutation.isPending}
                        onClick={() => claimMutation.mutate(row.id)}
                      >
                        Open claim
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {claimsQuery.isLoading ? (
            <LoadingState title="Loading claims" description="Fetching recovery workflow." />
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Claim</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No claims yet.
                    </td>
                  </tr>
                ) : (
                  claims.map((claim) => (
                    <tr key={claim.id}>
                      <td className="px-4 py-3 font-mono text-xs">{claim.claimNumber}</td>
                      <td className="px-4 py-3">{claim.status}</td>
                      <td className="px-4 py-3">{claim.claimAmount ?? "—"}</td>
                      <td className="px-4 py-3 space-x-2">
                        {claim.status === "ELIGIBLE" ? (
                          <button
                            type="button"
                            className="text-brand-700 underline"
                            onClick={() =>
                              transitionMutation.mutate({ id: claim.id, status: "PREPARED" })
                            }
                          >
                            Prepare
                          </button>
                        ) : null}
                        {claim.status === "PREPARED" ? (
                          <button
                            type="button"
                            className="text-brand-700 underline"
                            onClick={() =>
                              transitionMutation.mutate({ id: claim.id, status: "SUBMITTED" })
                            }
                          >
                            Submit
                          </button>
                        ) : null}
                        {claim.status === "SUBMITTED" ? (
                          <>
                            <button
                              type="button"
                              className="text-brand-700 underline"
                              onClick={() =>
                                transitionMutation.mutate({ id: claim.id, status: "ACCEPTED" })
                              }
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="text-slate-600 underline"
                              onClick={() =>
                                transitionMutation.mutate({ id: claim.id, status: "REJECTED" })
                              }
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {claim.status === "ACCEPTED" ? (
                          <button
                            type="button"
                            className="text-brand-700 underline"
                            onClick={() =>
                              transitionMutation.mutate({ id: claim.id, status: "RECOVERED" })
                            }
                          >
                            Recovered
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
