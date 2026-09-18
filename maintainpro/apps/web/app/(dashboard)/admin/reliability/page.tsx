"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type ReliabilityPolicy = {
  id: string;
  repeatWindowDays: number;
  matchSameFaultCode: boolean;
  matchSameAsset: boolean;
  requireRcaOnRepeat: boolean;
  requirePermitForCriticalAssets: boolean;
  requireLotoWhenPermitRequires: boolean;
  permitRequiredCriticalities: string;
};

type AssetRow = {
  id: string;
  assetTag: string | null;
  name: string;
  criticalityLevel: string | null;
  criticality: string | null;
  status: string;
};

type RcaCase = {
  id: string;
  status: string;
  problemStatement: string;
  repeatCandidate: boolean;
  similarWoCount: number;
  workOrderId: string | null;
  assetId: string | null;
  capaActions?: Array<{ id: string; kind: string; status: string; description: string }>;
};

export default function AdminReliabilityPage() {
  const pathname = usePathname();
  const underMaintenance = pathname?.startsWith("/maintenance/reliability") ?? false;
  const qc = useQueryClient();
  const [tab, setTab] = useState<"policy" | "criticality" | "rca">("policy");
  const [critLevel, setCritLevel] = useState("CRITICAL");
  const [critAssetId, setCritAssetId] = useState("");
  const [rcaForm, setRcaForm] = useState({
    workOrderId: "",
    problemStatement: "",
    failureCode: ""
  });

  const policyQuery = useQuery({
    queryKey: withTenantScope(["admin", "reliability-policy"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ReliabilityPolicy }>("/reliability/policy");
      return res.data.data;
    }
  });

  const assetsQuery = useQuery({
    queryKey: withTenantScope(["admin", "asset-criticality"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: AssetRow[] }>("/reliability/asset-criticality");
      return res.data.data;
    },
    enabled: tab === "criticality"
  });

  const rcaQuery = useQuery({
    queryKey: withTenantScope(["admin", "rca"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: RcaCase[] }>("/reliability/rca");
      return res.data.data;
    },
    enabled: tab === "rca"
  });

  const savePolicy = useMutation({
    mutationFn: async (patch: Partial<ReliabilityPolicy> & { reason?: string }) => {
      await apiClient.patch("/reliability/policy", patch);
    },
    onSuccess: () => {
      toast.success("Reliability policy saved");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "reliability-policy"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Save failed"))
  });

  const setCriticality = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/assets/${critAssetId}/criticality`, {
        criticalityLevel: critLevel,
        reason: "Admin criticality update"
      });
    },
    onSuccess: () => {
      toast.success("Criticality updated");
      setCritAssetId("");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "asset-criticality"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Update failed"))
  });

  const createRca = useMutation({
    mutationFn: async () => {
      await apiClient.post("/reliability/rca", {
        workOrderId: rcaForm.workOrderId || undefined,
        problemStatement: rcaForm.problemStatement,
        failureCode: rcaForm.failureCode || undefined
      });
    },
    onSuccess: () => {
      toast.success("RCA case created");
      setRcaForm({ workOrderId: "", problemStatement: "", failureCode: "" });
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "rca"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Create failed"))
  });

  if (policyQuery.isLoading) {
    return <LoadingState title="Loading reliability" description="Fetching policy." />;
  }
  if (policyQuery.isError) {
    return (
      <ErrorState
        title="Unable to load reliability"
        description={getApiErrorMessage(policyQuery.error, "Request failed")}
        onRetry={() => policyQuery.refetch()}
      />
    );
  }

  const policy = policyQuery.data!;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs
        items={
          underMaintenance
            ? [
                { label: "Maintenance", href: "/maintenance" },
                { label: "Reliability" }
              ]
            : [
                { label: "Admin", href: "/admin" },
                { label: "Maintenance config", href: "/admin/maintenance-config" },
                { label: "Reliability & safety" }
              ]
        }
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {underMaintenance ? "Reliability" : "Reliability & safety"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Downtime context, repeat-failure window, asset criticality, RCA/CAPA, and permit start gates.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["policy", "Policy"],
            ["criticality", "Asset criticality"],
            ["rca", "RCA / CAPA"]
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === key ? "bg-brand-600 text-white" : "border border-slate-200 bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "policy" ? (
        <div className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <label className="block text-sm">
            <span className="text-slate-700">Repeat failure window (days)</span>
            <input
              type="number"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              defaultValue={policy.repeatWindowDays}
              onBlur={(e) =>
                savePolicy.mutate({
                  repeatWindowDays: Number(e.target.value),
                  reason: "Repeat window updated"
                })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              defaultChecked={policy.matchSameAsset}
              onChange={(e) =>
                savePolicy.mutate({
                  matchSameAsset: e.target.checked,
                  reason: "Match same asset toggled"
                })
              }
            />
            Match same asset
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              defaultChecked={policy.matchSameFaultCode}
              onChange={(e) =>
                savePolicy.mutate({
                  matchSameFaultCode: e.target.checked,
                  reason: "Match same fault code toggled"
                })
              }
            />
            Match same fault code
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              defaultChecked={policy.requireRcaOnRepeat}
              onChange={(e) =>
                savePolicy.mutate({
                  requireRcaOnRepeat: e.target.checked,
                  reason: "Require RCA on repeat toggled"
                })
              }
            />
            Flag / require RCA on repeat candidate
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              defaultChecked={policy.requirePermitForCriticalAssets}
              onChange={(e) =>
                savePolicy.mutate({
                  requirePermitForCriticalAssets: e.target.checked,
                  reason: "Permit gate toggled"
                })
              }
            />
            Require work permit before start for critical assets
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              defaultChecked={policy.requireLotoWhenPermitRequires}
              onChange={(e) =>
                savePolicy.mutate({
                  requireLotoWhenPermitRequires: e.target.checked,
                  reason: "LOTO gate toggled"
                })
              }
            />
            Require verified LOTO when a permit requires isolation
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Criticalities requiring permit (CSV)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              defaultValue={policy.permitRequiredCriticalities}
              onBlur={(e) =>
                savePolicy.mutate({
                  permitRequiredCriticalities: e.target.value.split(",").map((s) => s.trim()),
                  reason: "Permit criticality list updated"
                } as never)
              }
            />
          </label>
        </div>
      ) : null}

      {tab === "criticality" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <label className="text-sm">
              Asset ID
              <input
                className="mt-1 block w-64 rounded border border-slate-300 px-3 py-2"
                value={critAssetId}
                onChange={(e) => setCritAssetId(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Level
              <select
                className="mt-1 block rounded border border-slate-300 px-3 py-2"
                value={critLevel}
                onChange={(e) => setCritLevel(e.target.value)}
              >
                {["CRITICAL", "HIGH", "MEDIUM", "LOW", "NON_CRITICAL"].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={!critAssetId || setCriticality.isPending}
              onClick={() => setCriticality.mutate()}
            >
              Update
            </button>
          </div>
          {assetsQuery.isLoading ? (
            <LoadingState title="Loading assets" description="Criticality register." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Tag</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Level</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(assetsQuery.data ?? []).map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{a.assetTag ?? a.id.slice(0, 8)}</td>
                      <td className="px-3 py-2">{a.name}</td>
                      <td className="px-3 py-2">{a.criticalityLevel ?? a.criticality ?? "—"}</td>
                      <td className="px-3 py-2">{a.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "rca" ? (
        <div className="space-y-4">
          <div className="grid max-w-2xl gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Work order ID (optional)"
              value={rcaForm.workOrderId}
              onChange={(e) => setRcaForm((f) => ({ ...f, workOrderId: e.target.value }))}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Failure code (optional)"
              value={rcaForm.failureCode}
              onChange={(e) => setRcaForm((f) => ({ ...f, failureCode: e.target.value }))}
            />
            <textarea
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              rows={3}
              placeholder="Problem statement"
              value={rcaForm.problemStatement}
              onChange={(e) => setRcaForm((f) => ({ ...f, problemStatement: e.target.value }))}
            />
            <button
              type="button"
              className="w-fit rounded bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={!rcaForm.problemStatement || createRca.isPending}
              onClick={() => createRca.mutate()}
            >
              Create RCA
            </button>
          </div>
          <div className="space-y-2">
            {(rcaQuery.data ?? []).map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{row.status}</span>
                  {row.repeatCandidate ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Repeat candidate ({row.similarWoCount})
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-slate-700">{row.problemStatement}</p>
                {(row.capaActions?.length ?? 0) > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-slate-600">
                    {row.capaActions!.map((c) => (
                      <li key={c.id}>
                        [{c.kind}] {c.status}: {c.description}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
