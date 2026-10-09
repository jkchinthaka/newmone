"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type Tab = "policy" | "repeats" | "criticality" | "rca";

type ReliabilityPolicy = {
  id: string;
  repeatWindowDays: number;
  matchSameFaultCode: boolean;
  matchSameAsset: boolean;
  requireRcaOnRepeat: boolean;
  repeatAction?: string;
  requirePermitForCriticalAssets: boolean;
  requireLotoWhenPermitRequires: boolean;
  permitRequiredCriticalities: string;
};

type PolicyDraft = {
  repeatWindowDays: number;
  matchSameFaultCode: boolean;
  matchSameAsset: boolean;
  repeatAction: "FLAG_ONLY" | "MANAGER_REVIEW" | "REQUIRE_RCA";
  requirePermitForCriticalAssets: boolean;
  requireLotoWhenPermitRequires: boolean;
  permitRequiredCriticalities: string[];
};

type AssetRow = {
  id: string;
  assetTag: string | null;
  name: string;
  category?: string | null;
  location?: string | null;
  criticalityLevel: string | null;
  criticality: string | null;
  status: string;
  updatedAt?: string;
};

type RcaCase = {
  id: string;
  status: string;
  problemStatement: string;
  failureCode: string | null;
  source: string | null;
  ownerId: string | null;
  dueDate: string | null;
  workOrderId: string | null;
  assetId: string | null;
  capaActions?: Array<{ id: string; status: string; dueDate?: string | null }>;
};

type Cluster = {
  clusterKey: string | null;
  assetName: string;
  assetCode: string;
  failureCode: string;
  failureCount: number;
  firstOccurrence: string | null;
  lastOccurrence: string | null;
  windowDays: number;
  downtimeHours: number | null;
  workOrders: Array<{ id: string; woNumber: string }>;
  rcaId: string | null;
  rcaStatus: string | null;
  candidateStatus: string;
};

type PageMeta = { page: number; pageSize: number; total: number };

const LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const ACTIONS = [
  ["FLAG_ONLY", "Flag only"],
  ["MANAGER_REVIEW", "Require manager review"],
  ["REQUIRE_RCA", "Require RCA"]
] as const;

function toDraft(policy: ReliabilityPolicy): PolicyDraft {
  const action = policy.repeatAction || (policy.requireRcaOnRepeat ? "REQUIRE_RCA" : "FLAG_ONLY");
  return {
    repeatWindowDays: policy.repeatWindowDays,
    matchSameFaultCode: policy.matchSameFaultCode,
    matchSameAsset: policy.matchSameAsset,
    repeatAction: action === "MANAGER_REVIEW" || action === "REQUIRE_RCA" ? action : "FLAG_ONLY",
    requirePermitForCriticalAssets: policy.requirePermitForCriticalAssets,
    requireLotoWhenPermitRequires: policy.requireLotoWhenPermitRequires,
    permitRequiredCriticalities: policy.permitRequiredCriticalities.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean)
  };
}

function actionLabel(action: PolicyDraft["repeatAction"]) {
  if (action === "REQUIRE_RCA") return "RCA required";
  if (action === "MANAGER_REVIEW") return "manager review required";
  return "flag only";
}

export function ReliabilityWorkbench() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const underMaintenance = pathname?.startsWith("/maintenance/reliability") ?? false;
  const qc = useQueryClient();
  const tab = (searchParams.get("tab") as Tab) || "policy";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const owner = searchParams.get("owner") || "";
  const criticality = searchParams.get("criticality") || "";
  const sort = searchParams.get("sort") || "";
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [searchInput, setSearchInput] = useState(search);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkLevel, setBulkLevel] = useState("HIGH");
  const [bulkReason, setBulkReason] = useState("");
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [rcaForm, setRcaForm] = useState({ problemStatement: "", failureCode: "", assetId: "" });

  const writeQuery = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route);
  };

  const policyQuery = useQuery({
    queryKey: withTenantScope(["admin", "reliability-policy"]),
    queryFn: async () => (await apiClient.get<{ data: ReliabilityPolicy }>("/reliability/policy")).data.data
  });
  const summaryQuery = useQuery({
    queryKey: withTenantScope(["admin", "reliability-summary"]),
    queryFn: async () =>
        (
          await apiClient.get<{ data: { repeatFailures: number; openRcas: number; overdueCapas: number; criticalAssets: number } }>(
            "/reliability/summary"
          )
        ).data.data
  });
  const serverDraft = policyQuery.data ? toDraft(policyQuery.data) : null;
  const activeDraft = draft ?? serverDraft;
  const dirty = Boolean(draft && serverDraft && JSON.stringify(draft) !== JSON.stringify(serverDraft));

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const clustersQuery = useQuery({
    queryKey: withTenantScope(["admin", "repeat-clusters", page, search]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Cluster[]; meta: PageMeta }>("/reliability/repeat-candidates", {
        params: { page, pageSize: 25, search: search || undefined }
      });
      return { items: res.data.data, meta: res.data.meta };
    },
    enabled: tab === "repeats"
  });
  const assetsQuery = useQuery({
    queryKey: withTenantScope(["admin", "asset-criticality", page, search, criticality]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: AssetRow[]; meta: PageMeta }>("/reliability/asset-criticality", {
        params: { page, pageSize: 25, search: search || undefined, criticalityLevel: criticality || undefined }
      });
      return { items: res.data.data, meta: res.data.meta };
    },
    enabled: tab === "criticality"
  });
  const rcaQuery = useQuery({
    queryKey: withTenantScope(["admin", "rca", page, search, status, owner, sort]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: RcaCase[]; meta: PageMeta }>("/reliability/rca", {
        params: { page, pageSize: 25, search: search || undefined, status: status || undefined, ownerId: owner || undefined, sort: sort || undefined }
      });
      return { items: res.data.data, meta: res.data.meta };
    },
    enabled: tab === "rca"
  });

  const savePolicy = useMutation({
    mutationFn: async (next: PolicyDraft) => {
      await apiClient.patch("/reliability/policy", {
        ...next,
        reason: "Reliability policy saved"
      });
    },
    onSuccess: () => {
      toast.success("Reliability policy updated successfully.");
      setDraft(null);
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "reliability-policy"]) });
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "repeat-clusters"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We couldn't save the reliability policy."))
  });

  const bulkCriticality = useMutation({
    mutationFn: async () => {
      await apiClient.post("/reliability/asset-criticality/bulk", {
        assetIds: selected,
        criticalityLevel: bulkLevel,
        reason: bulkReason
      });
    },
    onSuccess: () => {
      toast.success("Criticality updated");
      setSelected([]);
      setBulkReason("");
      setConfirmBulk(false);
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "asset-criticality"]) });
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "reliability-summary"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We couldn't update asset criticality."))
  });

  const createRca = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ data: { id: string } }>("/reliability/rca", {
        problemStatement: rcaForm.problemStatement,
        failureCode: rcaForm.failureCode || undefined,
        assetId: rcaForm.assetId || undefined,
        source: "MANAGER"
      });
      return res.data.data;
    },
    onSuccess: (created) => {
      toast.success("RCA case created");
      setRcaForm({ problemStatement: "", failureCode: "", assetId: "" });
      router.push(`/maintenance/reliability/rca/${created.id}` as Route);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We couldn't create the RCA."))
  });

  const selectedAssets = useMemo(
    () => (assetsQuery.data?.items ?? []).filter((row) => selected.includes(row.id)),
    [assetsQuery.data?.items, selected]
  );

  if (policyQuery.isLoading) return <LoadingState title="Loading reliability" description="Fetching policy." />;
  if (policyQuery.isError || !policyQuery.data || !activeDraft) {
    return (
      <ErrorState
        title="We couldn't load reliability settings."
        description={getApiErrorMessage(policyQuery.error, "Request failed")}
        onRetry={() => policyQuery.refetch()}
      />
    );
  }

  const changeTab = (next: Tab) => {
    if (dirty && !window.confirm("You have unsaved policy changes. Leave this tab?")) return;
    writeQuery({ tab: next === "policy" ? null : next, page: null });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs
        items={
          underMaintenance
            ? [{ label: "Maintenance", href: "/maintenance" }, { label: "Reliability" }]
            : [
                { label: "Admin", href: "/admin" },
                { label: "Maintenance config", href: "/admin/maintenance-config" },
                { label: "Reliability" }
              ]
        }
      />
      <div>
        <h1 className="page-title">Reliability</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Manage repeat-failure rules, asset criticality, RCA/CAPA, and safety gates for high-risk maintenance.
        </p>
      </div>
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Repeat failures", summaryQuery.data?.repeatFailures ?? null, "repeats"],
            ["Open RCAs", summaryQuery.data?.openRcas ?? null, "rca"],
            ["Overdue CAPAs", summaryQuery.data?.overdueCapas ?? null, "rca"],
            ["Critical assets", summaryQuery.data?.criticalAssets ?? null, "criticality"]
          ] as const
        ).map(([label, count, next]) => (
          <button key={label} type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left" onClick={() => changeTab(next)}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 page-title">{count ?? "—"}</p>
          </button>
        ))}
      </section>
      <div className="flex flex-wrap gap-2" role="tablist">
        {(
          [
            ["policy", "Policy"],
            ["repeats", "Repeat failures"],
            ["criticality", "Asset criticality"],
            ["rca", "RCA / CAPA"]
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => changeTab(key)}
            className={`min-h-11 rounded-md px-3 py-1.5 text-sm ${tab === key ? "bg-brand-600 text-white" : "border border-slate-200 bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "policy" ? (
        <form
          className="max-w-xl space-y-5 rounded-lg border border-slate-200 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (activeDraft.repeatWindowDays < 1 || activeDraft.repeatWindowDays > 730) {
              toast.error("Repeat window must be between 1 and 730 days.");
              return;
            }
            savePolicy.mutate(activeDraft);
          }}
        >
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Current rule: {activeDraft.matchSameAsset ? "same asset" : "any asset"}
            {activeDraft.matchSameFaultCode ? " + same fault code" : ""} within {activeDraft.repeatWindowDays || 0} days →{" "}
            {actionLabel(activeDraft.repeatAction)}
          </p>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Repeat failure window (days)</span>
            <input
              type="number"
              min={1}
              max={730}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={activeDraft.repeatWindowDays}
              onChange={(event) => setDraft({ ...activeDraft, repeatWindowDays: Number(event.target.value) })}
            />
          </label>
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-slate-700">Match criteria</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={activeDraft.matchSameAsset} onChange={(event) => setDraft({ ...activeDraft, matchSameAsset: event.target.checked })} />
              Same asset
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={activeDraft.matchSameFaultCode} onChange={(event) => setDraft({ ...activeDraft, matchSameFaultCode: event.target.checked })} />
              Same fault code
            </label>
          </fieldset>
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-slate-700">Repeat failure action</legend>
            {ACTIONS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="repeat-action" checked={activeDraft.repeatAction === value} onChange={() => setDraft({ ...activeDraft, repeatAction: value })} />
                {label}
              </label>
            ))}
          </fieldset>
          <section className="space-y-3 border-t border-slate-200 pt-4">
            <h2 className="text-sm font-semibold text-slate-900">Work permit controls</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activeDraft.requirePermitForCriticalAssets}
                onChange={(event) => setDraft({ ...activeDraft, requirePermitForCriticalAssets: event.target.checked })}
              />
              Require work permit before work starts for selected criticalities
            </label>
            <fieldset className="space-y-2 text-sm">
              <legend className="font-medium text-slate-700">Criticalities that require a permit</legend>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((level) => {
                  const selectedLevel = activeDraft.permitRequiredCriticalities.includes(level);
                  return (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={selectedLevel}
                      className={`min-h-11 rounded-full border px-3 ${selectedLevel ? "border-brand-600 bg-brand-50" : "border-slate-300"}`}
                      onClick={() => {
                        const current = new Set(activeDraft.permitRequiredCriticalities);
                        if (current.has(level)) current.delete(level);
                        else current.add(level);
                        setDraft({ ...activeDraft, permitRequiredCriticalities: [...current] });
                      }}
                    >
                      {level.charAt(0) + level.slice(1).toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </section>
          <section className="space-y-2 border-t border-slate-200 pt-4">
            <h2 className="text-sm font-semibold text-slate-900">LOTO / isolation controls</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activeDraft.requireLotoWhenPermitRequires}
                onChange={(event) => setDraft({ ...activeDraft, requireLotoWhenPermitRequires: event.target.checked })}
              />
              Require verified LOTO when the permit requires isolation
            </label>
          </section>
          <div className="flex flex-wrap items-center gap-2">
            {dirty ? <p className="text-sm text-amber-800">Unsaved changes</p> : null}
            {savePolicy.isPending ? <p className="text-sm text-slate-600">Saving...</p> : null}
            <button type="button" className="min-h-11 rounded border border-slate-300 px-4 py-2 text-sm" onClick={() => setDraft(null)} disabled={!dirty || savePolicy.isPending}>
              Reset
            </button>
            <button type="submit" className="min-h-11 rounded bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={!dirty || savePolicy.isPending}>
              Save Policy
            </button>
          </div>
          {savePolicy.isError ? (
            <button type="submit" className="text-sm text-rose-700 underline">
              Save failed. Retry
            </button>
          ) : null}
        </form>
      ) : null}

      {tab === "repeats" ? (
        <ClusterTable
          loading={clustersQuery.isLoading}
          error={clustersQuery.isError ? getApiErrorMessage(clustersQuery.error, "Request failed") : null}
          onRetry={() => clustersQuery.refetch()}
          items={clustersQuery.data?.items ?? []}
          meta={clustersQuery.data?.meta}
          search={searchInput}
          onSearch={(value) => {
            setSearchInput(value);
            writeQuery({ search: value || null, page: null });
          }}
          onPage={(next) => writeQuery({ page: String(next) })}
        />
      ) : null}

      {tab === "criticality" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Search
              <input className="mt-1 block rounded border border-slate-300 px-3 py-2" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onBlur={() => writeQuery({ search: searchInput || null, page: null })} />
            </label>
            <label className="text-sm">
              Criticality
              <select className="mt-1 block rounded border border-slate-300 px-3 py-2" value={criticality} onChange={(event) => writeQuery({ criticality: event.target.value || null, page: null })}>
                <option value="">All</option>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              New criticality
              <select className="mt-1 block rounded border border-slate-300 px-3 py-2" value={bulkLevel} onChange={(event) => setBulkLevel(event.target.value)}>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Reason
              <input className="mt-1 block w-64 rounded border border-slate-300 px-3 py-2" value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} />
            </label>
            <button type="button" className="min-h-11 rounded bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={selected.length === 0 || !bulkReason.trim()} onClick={() => setConfirmBulk(true)}>
              Review update
            </button>
          </div>
          {assetsQuery.isLoading ? <LoadingState title="Loading asset criticality" description="Fetching the current page." /> : null}
          {assetsQuery.isError ? (
            <ErrorState title="We couldn't load asset criticality." description={getApiErrorMessage(assetsQuery.error, "Request failed")} onRetry={() => assetsQuery.refetch()} />
          ) : null}
          {assetsQuery.data && assetsQuery.data.items.length === 0 ? <p className="text-sm text-slate-600">No assets available for criticality classification.</p> : null}
          {assetsQuery.data && assetsQuery.data.items.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Select</th>
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Criticality</th>
                    <th className="px-3 py-2">Last reviewed</th>
                  </tr>
                </thead>
                <tbody>
                  {assetsQuery.data.items.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.name}`}
                          checked={selected.includes(row.id)}
                          onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.name}</div>
                        <div className="font-mono text-xs text-slate-500">{row.assetTag}</div>
                      </td>
                      <td className="px-3 py-2">{row.category || "—"}</td>
                      <td className="px-3 py-2">{row.location || "—"}</td>
                      <td className="px-3 py-2">{row.criticalityLevel || row.criticality || "Unclassified"}</td>
                      <td className="px-3 py-2">{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <Pager meta={assetsQuery.data?.meta} onPage={(next) => writeQuery({ page: String(next) })} />
          {confirmBulk ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4" role="dialog" aria-labelledby="bulk-criticality-title">
              <h2 id="bulk-criticality-title" className="font-semibold text-slate-900">Confirm criticality update</h2>
              <p className="mt-1 text-sm text-slate-600">{selectedAssets.length} assets will become {bulkLevel}. Reason: {bulkReason}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {selectedAssets.map((row) => (
                  <li key={row.id}>{row.name}: {row.criticalityLevel || "Unclassified"} → {bulkLevel}</li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button type="button" className="min-h-11 rounded border border-slate-300 px-3 text-sm" onClick={() => setConfirmBulk(false)}>Cancel</button>
                <button type="button" className="min-h-11 rounded bg-brand-600 px-3 text-sm text-white disabled:opacity-50" disabled={bulkCriticality.isPending} onClick={() => bulkCriticality.mutate()}>Confirm</button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "rca" ? (
        <section className="space-y-4">
          <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); writeQuery({ search: searchInput || null, page: null }); }}>
            <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Search RCA, asset, or fault" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={status} onChange={(event) => writeQuery({ status: event.target.value || null, page: null })} aria-label="Status">
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_REVIEW">Under investigation</option>
              <option value="COMPLETED">Verification pending</option>
              <option value="CLOSED">Closed</option>
            </select>
            <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Owner id" value={owner} onChange={(event) => writeQuery({ owner: event.target.value || null, page: null })} aria-label="Owner" />
            <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={sort} onChange={(event) => writeQuery({ sort: event.target.value || null })} aria-label="Sort">
              <option value="">Newest</option>
              <option value="due">Due date</option>
            </select>
          </form>
          <form className="grid max-w-2xl gap-2 rounded-lg border border-slate-200 bg-white p-4" onSubmit={(event) => { event.preventDefault(); createRca.mutate(); }}>
            <h2 className="text-sm font-semibold">Open an RCA</h2>
            <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Asset id (optional)" value={rcaForm.assetId} onChange={(event) => setRcaForm((form) => ({ ...form, assetId: event.target.value }))} />
            <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Fault code" value={rcaForm.failureCode} onChange={(event) => setRcaForm((form) => ({ ...form, failureCode: event.target.value }))} />
            <textarea className="rounded border border-slate-300 px-3 py-2 text-sm" rows={3} placeholder="Problem statement" required value={rcaForm.problemStatement} onChange={(event) => setRcaForm((form) => ({ ...form, problemStatement: event.target.value }))} />
            <button type="submit" className="w-fit rounded bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={createRca.isPending || !rcaForm.problemStatement.trim()}>Create RCA</button>
          </form>
          {rcaQuery.isLoading ? <LoadingState title="Loading RCA records" description="Fetching the current page." /> : null}
          {rcaQuery.isError ? <ErrorState title="We couldn't load RCA records." description={getApiErrorMessage(rcaQuery.error, "Request failed")} onRetry={() => rcaQuery.refetch()} /> : null}
          {rcaQuery.data && rcaQuery.data.items.length === 0 ? <p className="text-sm text-slate-600">No RCA records yet.</p> : null}
          {rcaQuery.data && rcaQuery.data.items.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">RCA</th>
                    <th className="px-3 py-2">Failure</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">CAPA</th>
                  </tr>
                </thead>
                <tbody>
                  {rcaQuery.data.items.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-2"><Link className="font-medium text-brand-700 underline" href={`/maintenance/reliability/rca/${row.id}`}>{row.id.slice(0, 8)}</Link></td>
                      <td className="px-3 py-2">{row.failureCode || row.problemStatement}</td>
                      <td className="px-3 py-2">{row.source || "—"}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"}</td>
                      <td className="px-3 py-2">{(row.capaActions ?? []).filter((action) => action.status !== "VERIFIED" && action.status !== "CLOSED" && action.status !== "CANCELLED").length} open</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <Pager meta={rcaQuery.data?.meta} onPage={(next) => writeQuery({ page: String(next) })} />
        </section>
      ) : null}
    </div>
  );
}

function Pager({ meta, onPage }: { meta?: PageMeta; onPage: (page: number) => void }) {
  if (!meta || meta.total <= meta.pageSize) return null;
  const pages = Math.ceil(meta.total / meta.pageSize);
  return (
    <div className="flex items-center gap-2 text-sm">
      <button type="button" className="min-h-11 rounded border px-3 disabled:opacity-50" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</button>
      <span>Page {meta.page} of {pages}</span>
      <button type="button" className="min-h-11 rounded border px-3 disabled:opacity-50" disabled={meta.page >= pages} onClick={() => onPage(meta.page + 1)}>Next</button>
    </div>
  );
}

function ClusterTable(props: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  items: Cluster[];
  meta?: PageMeta;
  search: string;
  onSearch: (value: string) => void;
  onPage: (page: number) => void;
}) {
  if (props.loading) return <LoadingState title="Loading repeat failures" description="Checking the current policy window." />;
  if (props.error) return <ErrorState title="We couldn't load repeat failures." description={props.error} onRetry={props.onRetry} />;
  return (
    <section className="space-y-3">
      <input className="w-full max-w-md rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Search asset or fault code" value={props.search} onChange={(event) => props.onSearch(event.target.value)} />
      {props.items.length === 0 ? <p className="text-sm text-slate-600">No repeat failures detected for the current policy.</p> : null}
      {props.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Fault code</th>
                <th className="px-3 py-2">Count</th>
                <th className="px-3 py-2">Window</th>
                <th className="px-3 py-2">Last failure</th>
                <th className="px-3 py-2">Downtime</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">RCA</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((row) => (
                <tr key={row.clusterKey ?? `${row.assetCode}-${row.failureCode}`} className="border-b last:border-0">
                  <td className="px-3 py-2">{row.assetName}<div className="font-mono text-xs text-slate-500">{row.assetCode}</div></td>
                  <td className="px-3 py-2 font-mono text-xs">{row.failureCode}</td>
                  <td className="px-3 py-2">{row.failureCount}</td>
                  <td className="px-3 py-2">{row.windowDays} days</td>
                  <td className="px-3 py-2">{row.lastOccurrence ? new Date(row.lastOccurrence).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2">{row.downtimeHours == null ? "—" : `${row.downtimeHours} hrs`}</td>
                  <td className="px-3 py-2">{row.candidateStatus}</td>
                  <td className="px-3 py-2">{row.rcaId ? <Link className="text-brand-700 underline" href={`/maintenance/reliability/rca/${row.rcaId}`}>{row.rcaStatus}</Link> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <Pager meta={props.meta} onPage={props.onPage} />
    </section>
  );
}
