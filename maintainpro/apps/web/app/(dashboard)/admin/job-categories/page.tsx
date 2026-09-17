"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { JOB_DOMAIN_LABELS, JOB_DOMAINS } from "@/lib/job-domain";
import { withTenantScope } from "@/lib/tenant-query";

type JobCategory = {
  id: string;
  jobDomain: string;
  level: string;
  code: string;
  name: string;
  active: boolean;
  parent?: { id: string; name: string } | null;
};

export default function AdminJobCategoriesPage() {
  const qc = useQueryClient();
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

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Job Categories" }
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Job Categories</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configurable main and sub categories for Machinery, Service, and Vehicle jobs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {seedMutation.isPending ? "Seeding…" : "Seed defaults"}
        </button>
      </div>

      {JOB_DOMAINS.map((domain) => {
        const domainRows = rows.filter((r) => r.jobDomain === domain);
        return (
          <section key={domain} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{JOB_DOMAIN_LABELS[domain]}</h2>
            {domainRows.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No categories yet — seed defaults to populate.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {domainRows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-900">{row.name}</span>
                      <span className="ml-2 text-slate-500">
                        {row.level} · {row.code}
                        {row.parent ? ` · under ${row.parent.name}` : ""}
                      </span>
                    </div>
                    <span className={row.active ? "text-emerald-700" : "text-slate-400"}>
                      {row.active ? "Active" : "Inactive"}
                    </span>
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
