"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { fetchActionCenterSnapshot } from "@/lib/action-center-api";
import {
  actionCenterIsReadOnly,
  buildActionCenterSections,
  getActionCenterDescription,
  getActionCenterTitle,
  resolveActionCenterVariant
} from "@/lib/action-center";
import { fetchKpiOverview, type KpiOverviewItem } from "@/lib/reporting-kpis-api";
import { resolveRoleHome } from "@/lib/role-home";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { ActionSection } from "./action-section";

const MANAGER_KPI_CODES = ["WO_OVERDUE", "WO_BACKLOG", "PM_COMPLIANCE", "MTTR"];

function isManagerVariant(variant: string): boolean {
  return ["manager", "admin", "management_viewer"].includes(variant.toLowerCase());
}

function KpiStrip({ items }: { items: KpiOverviewItem[] }) {
  const shown = items.filter((k) => MANAGER_KPI_CODES.includes(k.code));
  if (shown.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {shown.map((kpi) => (
        <div
          key={kpi.code}
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          title={kpi.formulaSummary}
        >
          <p className="text-xs text-slate-500 truncate">{kpi.displayName}</p>
          {kpi.dataWarning ? (
            <p className="mt-1 text-sm font-medium text-amber-600" title={kpi.dataWarning}>
              N/A
            </p>
          ) : (
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {kpi.value !== null && kpi.value !== undefined
                ? kpi.unit === "%"
                  ? `${Number(kpi.value).toFixed(1)}%`
                  : kpi.unit === "hours"
                  ? `${Number(kpi.value).toFixed(1)}h`
                  : String(Math.round(Number(kpi.value)))
                : "—"}
              {kpi.unit && kpi.unit !== "%" && kpi.unit !== "hours" && kpi.unit !== "count" ? (
                <span className="text-xs text-slate-400 ml-1">{kpi.unit}</span>
              ) : null}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function RoleHomeCards({ roleName }: { roleName: string | null }) {
  const profile = resolveRoleHome(roleName);
  if (!profile.cards.length) return null;
  return (
    <section aria-label={`${profile.title} quick actions`}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {profile.title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {profile.cards.map((card) => (
          <Link
            key={card.id}
            href={card.href as any}
            className="group flex flex-col rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-400 hover:shadow-md"
          >
            <span className="text-sm font-medium text-slate-800 group-hover:text-blue-700">
              {card.title}
            </span>
            <span className="mt-1 text-xs text-slate-500 line-clamp-2">{card.description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ActionCenterPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const variant = resolveActionCenterVariant(roleName);
  const readOnly = actionCenterIsReadOnly(variant);
  const showKpis = isManagerVariant(variant);

  const query = useQuery({
    queryKey: ["action-center", user.id, roleName, user.tenantId],
    queryFn: () =>
      fetchActionCenterSnapshot({
        variant,
        roleName,
        userId: user.id,
        permissions: user.permissions
      }),
    refetchInterval: 60_000
  });

  const kpiQuery = useQuery({
    queryKey: ["kpi-overview", user.tenantId, roleName],
    queryFn: () => fetchKpiOverview(),
    enabled: showKpis,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <LoadingState title="Loading Action Center" description="Gathering operational priorities from live modules." />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <ErrorState
          title="Could not load Action Center"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }

  const snapshot = query.data;
  const sections = snapshot ? buildActionCenterSections(snapshot) : [];

  return (
    <div className="space-y-6">
      <PageBreadcrumbs />

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{getActionCenterTitle(variant)}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          {getActionCenterDescription(variant)}
          {readOnly ? " This view is read-only." : ""}
        </p>
      </header>

      {/* Phase 13: Role Home quick-action cards */}
      <RoleHomeCards roleName={roleName} />

      {/* Phase 13: KPI strip for manager/management_viewer roles */}
      {showKpis && kpiQuery.data && kpiQuery.data.length > 0 && (
        <KpiStrip items={kpiQuery.data} />
      )}

      <div className="space-y-8">
        {sections.map((section) => (
          <ActionSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
