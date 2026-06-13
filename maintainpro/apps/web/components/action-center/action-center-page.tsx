"use client";

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
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

import { ActionSection } from "./action-section";

export function ActionCenterPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const variant = resolveActionCenterVariant(roleName);
  const readOnly = actionCenterIsReadOnly(variant);

  const query = useQuery({
    queryKey: ["action-center", user.id, roleName],
    queryFn: () =>
      fetchActionCenterSnapshot({
        variant,
        roleName,
        userId: user.id
      }),
    refetchInterval: 60_000
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

      <div className="space-y-8">
        {sections.map((section) => (
          <ActionSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
