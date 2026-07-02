"use client";

import Link from "next/link";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  getDefaultFavoriteNavIds,
  getVisibleNavigationItems,
  type NavigationItem
} from "@/lib/navigation";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";
import { fetchActionCenterSnapshot } from "@/lib/action-center-api";
import { buildActionCenterSections, resolveActionCenterVariant } from "@/lib/action-center";

function WorkspaceLinkCard({ item }: { item: NavigationItem }) {
  return (
    <Link
      href={item.href as Route}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow"
    >
      <p className="font-semibold text-slate-900">{item.label}</p>
      {item.description ? <p className="mt-1 text-sm text-slate-600">{item.description}</p> : null}
    </Link>
  );
}

export default function WorkspacePage() {
  const user = useCurrentUser();
  const roleName = extractRoleName({ role: user.role });
  const workspaceItems = getVisibleNavigationItems(roleName, { permissions: user.permissions }).filter(
    (item) => item.category === "workspace" && item.id !== "my-workspace"
  );
  const favoriteIds = getDefaultFavoriteNavIds(roleName);
  const quickLinks = workspaceItems.filter((item) => favoriteIds.includes(item.id));

  const actionQuery = useQuery({
    queryKey: ["workspace", "action-center", roleName],
    queryFn: () =>
      fetchActionCenterSnapshot({
        variant: resolveActionCenterVariant(roleName),
        roleName,
        userId: user.id
      }),
    staleTime: 60_000,
    retry: 1
  });

  const sections = actionQuery.data ? buildActionCenterSections(actionQuery.data) : [];

  return (
    <div className="space-y-6 pb-20 xl:pb-6">
      <PageBreadcrumbs
        items={[
          { label: "Workspace", href: "/workspace" },
          { label: "My Workspace" }
        ]}
      />

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">My Workspace</h1>
        <p className="text-sm text-slate-600">
          Role-based shortcuts for {roleName?.replaceAll("_", " ") ?? "your account"}. Start with Action Center for
          today&apos;s priorities.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(quickLinks.length > 0 ? quickLinks : workspaceItems).map((item) => (
          <WorkspaceLinkCard key={item.id} item={item} />
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Today&apos;s actions</h2>
          <Link href="/action-center" className="text-sm font-medium text-brand-700 hover:underline">
            Open Action Center
          </Link>
        </div>

        {actionQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <Loader2 className="animate-spin" size={16} /> Loading action summary...
          </div>
        ) : null}

        {actionQuery.isError ? (
          <ErrorState
            title="Unable to load navigation actions"
            description={getApiErrorMessage(
              actionQuery.error,
              "Unable to load navigation actions. Please retry."
            )}
            onRetry={() => void actionQuery.refetch()}
          />
        ) : null}

        {!actionQuery.isLoading && !actionQuery.isError && sections.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No actions assigned to you right now.
          </div>
        ) : null}

        {sections.map((section) => (
          <div key={section.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-medium text-slate-900">{section.title}</h3>
            {section.description ? <p className="mt-1 text-sm text-slate-600">{section.description}</p> : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {section.items.length === 0 ? (
                <p className="text-sm text-slate-500">{section.emptyTitle ?? "No items in this section."}</p>
              ) : (
                section.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href as Route}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-brand-300"
                  >
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-slate-600">{item.description}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
