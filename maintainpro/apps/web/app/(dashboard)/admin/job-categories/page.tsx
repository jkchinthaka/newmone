"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { JOB_DOMAIN_LABELS, JOB_DOMAINS, type JobDomain } from "@/lib/job-domain";
import { withTenantScope } from "@/lib/tenant-query";

type JobCategory = {
  id: string;
  jobDomain: string;
  level: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder?: number;
  parent?: { id: string; name: string } | null;
};

export default function AdminJobCategoriesPage() {
  const qc = useQueryClient();
  const [domain, setDomain] = useState<JobDomain>("MACHINERY");
  const [level, setLevel] = useState<"MAIN" | "SUB">("SUB");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");

  const query = useQuery({
    queryKey: withTenantScope(["admin", "job-categories"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: JobCategory[] }>("/admin/maintenance-config/job-categories");
      return res.data.data;
    }
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/admin/maintenance-config/job-categories/seed-defaults");
      return res.data;
    },
    onSuccess: () => {
      toast.success("Default job categories seeded");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "job-categories"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Seed failed"))
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/admin/maintenance-config/job-categories", {
        jobDomain: domain,
        level,
        code,
        name,
        parentId: level === "SUB" ? parentId || undefined : undefined
      });
    },
    onSuccess: () => {
      toast.success("Category created");
      setCode("");
      setName("");
      setParentId("");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "job-categories"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Create failed"))
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: JobCategory) => {
      await apiClient.patch(`/admin/maintenance-config/job-categories/${row.id}`, {
        active: !row.active
      });
    },
    onSuccess: () => {
      toast.success("Category updated");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "job-categories"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Update failed"))
  });

  if (query.isLoading) {
    return <LoadingState title="Loading job categories" description="Fetching domain category catalog." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load job categories"
        description={getApiErrorMessage(query.error, "Request failed")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const rows = query.data ?? [];
  const mainParents = rows.filter((r) => r.jobDomain === domain && r.level === "MAIN");

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Maintenance Configuration", href: "/admin/maintenance-config" },
          { label: "Job Categories" }
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Job Categories</h1>
          <p className="mt-1 text-sm text-slate-600">
            Master data for Service Category and Problem Category on Machinery / Service / Vehicle
            work orders. Deactivate instead of deleting referenced categories.
          </p>
        </div>
        <button
          type="button"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          className="min-h-11 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {seedMutation.isPending ? "Seeding…" : "Seed defaults"}
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Add category</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm text-slate-700">
            <span className="font-medium">Domain</span>
            <select
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value as JobDomain);
                setParentId("");
              }}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {JOB_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {JOB_DOMAIN_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            <span className="font-medium">Level</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as "MAIN" | "SUB")}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="MAIN">MAIN</option>
              <option value="SUB">SUB</option>
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            <span className="font-medium">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="e.g. HVAC"
            />
          </label>
          <label className="block text-sm text-slate-700">
            <span className="font-medium">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Human-readable name"
            />
          </label>
          {level === "SUB" ? (
            <label className="block text-sm text-slate-700">
              <span className="font-medium">Parent MAIN</span>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Select parent…</option>
                {mainParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div />
          )}
        </div>
        <button
          type="button"
          className="mt-3 min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"
          disabled={createMutation.isPending || !code.trim() || !name.trim() || (level === "SUB" && !parentId)}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Saving…" : "Add category"}
        </button>
      </section>

      {JOB_DOMAINS.map((d) => {
        const domainRows = rows.filter((r) => r.jobDomain === d);
        return (
          <section key={d} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{JOB_DOMAIN_LABELS[d]}</h2>
            {domainRows.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No categories yet — seed defaults to populate.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {domainRows.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-900">{row.name}</span>
                      <span className="ml-2 text-slate-500">
                        {row.level} · {row.code}
                        {row.parent ? ` · under ${row.parent.name}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={row.active ? "text-emerald-700" : "text-slate-400"}>
                        {row.active ? "Active" : "Inactive"}
                      </span>
                      <button
                        type="button"
                        className="min-h-11 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate(row)}
                      >
                        {row.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
