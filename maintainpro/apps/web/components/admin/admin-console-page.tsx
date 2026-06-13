"use client";

import { useQuery } from "@tanstack/react-query";

import { SystemHealthSummary } from "@/components/dashboard/system-health-summary";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { PermissionState } from "@/components/ui/page-state";
import { getAdminConsoleSections, isAdminConsoleRole } from "@/lib/admin-console";
import { apiClient } from "@/lib/api-client";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { AdminSectionCard } from "./admin-section-card";

type TenantEnvelope = {
  data?: {
    id?: string;
    name?: string;
    slug?: string;
  };
};

export function AdminConsolePage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const sections = getAdminConsoleSections();

  const tenantQuery = useQuery({
    queryKey: ["admin-console", "tenant-me"],
    queryFn: async () => {
      const response = await apiClient.get<TenantEnvelope>("/tenants/me");
      return response.data.data ?? null;
    },
    enabled: isAdmin,
    staleTime: 60_000
  });

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageBreadcrumbs />
        <PermissionState
          title="Admin access required"
          description="The admin console is available to ADMIN and SUPER_ADMIN roles only. Backend authorization still controls access to underlying modules."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />

      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Admin Console</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Read-only administration overview for MaintainPro. Navigation visibility is a UX convenience only; backend RBAC
          remains authoritative for every module and API action.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="admin-session-heading">
        <h3 id="admin-session-heading" className="text-sm font-semibold text-slate-900">
          Current session
        </h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in as</dt>
            <dd className="mt-1 font-medium text-slate-900">{user.email ?? "Unknown user"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</dt>
            <dd className="mt-1 font-medium text-slate-900">{roleName ?? "Unknown role"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant ID</dt>
            <dd className="mt-1 break-all font-medium text-slate-900">{user.tenantId ?? "Not available"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active tenant</dt>
            <dd className="mt-1 font-medium text-slate-900">
              {tenantQuery.isLoading
                ? "Loading…"
                : tenantQuery.isError
                  ? "Requires API access"
                  : tenantQuery.data?.name ?? "Not connected"}
            </dd>
          </div>
        </dl>
      </section>

      <SystemHealthSummary />

      <section aria-labelledby="admin-modules-heading">
        <div className="mb-3">
          <h3 id="admin-modules-heading" className="text-sm font-semibold text-slate-900">
            Administration modules
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Placeholder cards for upcoming admin workflows. No user, tenant, or permission counts are displayed in this
            foundation pass.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <AdminSectionCard key={section.id} section={section} />
          ))}
        </div>
      </section>
    </div>
  );
}
