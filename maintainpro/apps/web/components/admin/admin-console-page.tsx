"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { PermissionState } from "@/components/ui/page-state";
import { fetchAdminOverview, type AdminOverview } from "@/lib/admin-governance-api";
import { getAdminConsoleSections, isAdminConsoleRole } from "@/lib/admin-console";
import { apiClient } from "@/lib/api-client";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser, type CurrentUser } from "@/lib/use-current-user";

import { AdminSectionCard } from "./admin-section-card";

type TenantEnvelope = {
  data?: {
    id?: string;
    name?: string;
    slug?: string;
  };
};

type OverviewCardProps = {
  label: string;
  value: number | string;
  sublabel?: string;
  variant?: "default" | "warning" | "critical";
  href?: string;
};

function OverviewCard({ label, value, sublabel, variant = "default", href }: OverviewCardProps) {
  const variantStyles = {
    default: "border-slate-200 bg-white",
    warning: "border-yellow-200 bg-yellow-50",
    critical: "border-red-200 bg-red-50"
  };
  const valueStyles = {
    default: "text-slate-900",
    warning: "text-yellow-800",
    critical: "text-red-800"
  };

  const content = (
    <div className={`rounded-xl border p-4 shadow-sm ${variantStyles[variant]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${valueStyles[variant]}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-slate-500">{sublabel}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href as any} className="block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }
  return content;
}

function AdminOverviewSignals({ overview }: { overview: AdminOverview }) {
  const { users, dataQuality, pendingImports } = overview;
  const dq = dataQuality.issuesBySeverity;
  const criticalOrHigh = dq.CRITICAL + dq.HIGH;

  return (
    <section aria-labelledby="admin-overview-heading">
      <h3 id="admin-overview-heading" className="mb-3 text-sm font-semibold text-slate-900">
        Operational signals
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard label="Active users" value={users.active} sublabel={`${users.inactive} inactive`} />
        <OverviewCard
          label="DQ issues"
          value={dataQuality.totalIssues}
          sublabel={`${criticalOrHigh} critical/high`}
          variant={criticalOrHigh > 0 ? "critical" : dataQuality.totalIssues > 0 ? "warning" : "default"}
          href="/admin/data-quality"
        />
        <OverviewCard
          label="Critical findings"
          value={dq.CRITICAL}
          variant={dq.CRITICAL > 0 ? "critical" : "default"}
          href={dq.CRITICAL > 0 ? "/admin/data-quality" : undefined}
        />
        <OverviewCard
          label="Pending imports"
          value={pendingImports}
          variant={pendingImports > 0 ? "warning" : "default"}
          href={pendingImports > 0 ? "/admin/bulk-imports" : undefined}
        />
      </div>
    </section>
  );
}

type AdminConsoleAuthorizedProps = {
  user: CurrentUser;
  roleName: string | null;
  tenantName: string;
  tenantLoading: boolean;
  tenantError: boolean;
};

function AdminConsoleAuthorized({
  user,
  roleName,
  tenantName,
  tenantLoading,
  tenantError
}: AdminConsoleAuthorizedProps) {
  const sections = getAdminConsoleSections();

  const overviewQuery = useQuery({
    queryKey: ["admin-governance", "overview"],
    queryFn: fetchAdminOverview,
    staleTime: 60_000,
    retry: false
  });

  return (
    <>
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Admin Console</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Maintenance operations administration. Backend RBAC remains authoritative for all API access.
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
              {tenantLoading ? "Loading…" : tenantError ? "Requires API access" : tenantName}
            </dd>
          </div>
        </dl>
      </section>

      {overviewQuery.data && <AdminOverviewSignals overview={overviewQuery.data} />}

      <section aria-labelledby="admin-modules-heading">
        <div className="mb-3">
          <h3 id="admin-modules-heading" className="text-sm font-semibold text-slate-900">
            Administration modules
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Navigate to any module below. Backend RBAC controls access — not navigation visibility.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <AdminSectionCard key={section.id} section={section} />
          ))}
        </div>
      </section>
    </>
  );
}

export function AdminConsolePage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);

  const tenantQuery = useQuery({
    queryKey: ["admin-console", "tenant-me"],
    queryFn: async () => {
      const response = await apiClient.get<TenantEnvelope>("/tenants/me");
      return response.data.data ?? null;
    },
    enabled: isAdmin,
    staleTime: 60_000
  });

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />

      {!isAdmin ? (
        <PermissionState
          title="Admin access required"
          description="The admin console is available to ADMIN and SUPER_ADMIN roles only. Backend authorization still controls access to underlying modules."
        />
      ) : (
        <AdminConsoleAuthorized
          user={user}
          roleName={roleName}
          tenantLoading={tenantQuery.isLoading}
          tenantError={tenantQuery.isError}
          tenantName={tenantQuery.data?.name ?? "Not connected"}
        />
      )}
    </div>
  );
}
