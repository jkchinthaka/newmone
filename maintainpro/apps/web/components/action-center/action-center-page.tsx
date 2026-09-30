"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-state";
import { fetchActionCenterSnapshot, fetchActionCenterSystemHealth } from "@/lib/action-center-api";
import {
  actionCenterIsReadOnly,
  actionCenterShowsKpis,
  actionCenterShowsSystemHealth,
  buildActionCenterSections,
  filterActionCenterSections,
  getActionCenterDescription,
  getActionCenterTitle,
  resolveActionCenterVariant,
  type ActionCenterErrorKind,
  type ActionCenterSnapshot
} from "@/lib/action-center";
import { fetchKpiOverview, type KpiOverviewItem } from "@/lib/reporting-kpis-api";
import { filterRoleHomeCards, resolveRoleHome, type RoleHomeCard } from "@/lib/role-home";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { ActionSection } from "./action-section";

const MANAGER_KPI_CODES = ["WO_OVERDUE", "WO_BACKLOG", "PM_COMPLIANCE", "MTTR"];

function healthErrorKind(error: unknown): ActionCenterErrorKind {
  const status = (error as { response?: { status?: number } } | null | undefined)?.response?.status;
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404 || status === 501) return "unavailable";
  if (typeof status === "number" && status >= 500) return "server";
  if (status === undefined) return "network";
  return "unknown";
}

function withSystemHealth(
  snapshot: ActionCenterSnapshot,
  health: {
    show: boolean;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    data: ActionCenterSnapshot["systemHealth"];
  }
): ActionCenterSnapshot {
  if (!health.show) return snapshot;
  if (health.isLoading) {
    return { ...snapshot, pending: { ...snapshot.pending, systemHealth: true } };
  }
  if (health.isError || !health.data) {
    return {
      ...snapshot,
      systemHealth: null,
      connections: { ...snapshot.connections, systemHealth: false },
      errors: { ...snapshot.errors, systemHealth: healthErrorKind(health.error) }
    };
  }
  return {
    ...snapshot,
    systemHealth: health.data,
    connections: { ...snapshot.connections, systemHealth: true }
  };
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

function RoleHomeCards({ title, cards }: { title: string; cards: RoleHomeCard[] }) {
  if (!cards.length) return null;
  return (
    <section aria-label={`${title} quick actions`}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => (
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

function ActionCenterSearch({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative max-w-md">
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search this page…"
        aria-label="Search Action Center"
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

export function ActionCenterPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const variant = resolveActionCenterVariant(roleName);
  const readOnly = actionCenterIsReadOnly(variant);
  const showKpis = actionCenterShowsKpis(roleName, user.permissions);
  const showSystemHealth = actionCenterShowsSystemHealth(variant);
  const [query, setQuery] = useState("");

  const query_ = useQuery({
    queryKey: ["action-center", user.id, roleName, user.tenantId],
    queryFn: () =>
      fetchActionCenterSnapshot({
        variant,
        roleName,
        userId: user.id,
        permissions: user.permissions,
        includeSystemHealth: false
      }),
    refetchInterval: 60_000
  });

  const healthQuery = useQuery({
    queryKey: ["action-center-system-health", user.tenantId],
    queryFn: fetchActionCenterSystemHealth,
    enabled: showSystemHealth,
    staleTime: 60_000,
    refetchInterval: 60_000
  });

  const kpiQuery = useQuery({
    queryKey: ["kpi-overview", user.tenantId, roleName],
    queryFn: () => fetchKpiOverview(),
    enabled: showKpis,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000
  });

  if (query_.isLoading) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <LoadingState title="Loading Action Center" description="Gathering operational priorities from live modules." />
      </div>
    );
  }

  if (query_.isError) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <ErrorState
          title="Could not load Action Center"
          error={query_.error}
          onRetry={() => query_.refetch()}
        />
      </div>
    );
  }

  const snapshot = query_.data
    ? withSystemHealth(query_.data, {
        show: showSystemHealth,
        isLoading: healthQuery.isLoading,
        isError: healthQuery.isError,
        error: healthQuery.error,
        data: healthQuery.data
      })
    : undefined;
  const sections = snapshot ? buildActionCenterSections(snapshot) : [];
  const filteredSections = filterActionCenterSections(sections, query);

  const roleProfile = resolveRoleHome(roleName);
  const filteredRoleCards = filterRoleHomeCards(roleProfile.cards, query);

  const trimmedQuery = query.trim();
  const hasNoResults =
    trimmedQuery.length > 0 && filteredSections.length === 0 && filteredRoleCards.length === 0;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs />

      <header className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{getActionCenterTitle(variant)}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            {getActionCenterDescription(variant)}
            {readOnly ? " This view is read-only." : ""}
          </p>
        </div>

        <ActionCenterSearch value={query} onChange={setQuery} />
      </header>

      {hasNoResults ? (
        <EmptyState
          title="No matches"
          description={`Nothing on this page matches "${trimmedQuery}". Try a different search term.`}
        />
      ) : (
        <>
          {/* Phase 13: Role Home quick-action cards */}
          <RoleHomeCards title={roleProfile.title} cards={filteredRoleCards} />

          {/* Phase 13: KPI strip for manager/management_viewer roles */}
          {!trimmedQuery && showKpis && kpiQuery.data && kpiQuery.data.length > 0 && (
            <KpiStrip items={kpiQuery.data} />
          )}

          <div className="space-y-8">
            {filteredSections.map((section) => (
              <ActionSection key={section.id} section={section} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
