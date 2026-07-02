"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bug, ClipboardList, Plus, ShieldAlert } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { fetchQaDashboard } from "@/lib/qa-api";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

export function QaDashboardPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);

  const query = useQuery({
    queryKey: ["qa", "dashboard"],
    queryFn: fetchQaDashboard,
    enabled: Boolean(user)
  });

  if (!user) return null;

  const data = query.data as Record<string, number | string | unknown> | undefined;
  const scope = data?.scope as string | undefined;

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">QA & Incidents</h2>
          <p className="mt-1 text-sm text-slate-500">
            Software quality register, incident tracking, RCA, regression, and release readiness.
          </p>
        </div>
        <Link
          href={"/qa/issues/new" as Route}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Report New Issue
        </Link>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href={"/qa/issues" as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
          Error Register
        </Link>
        <Link href={"/qa/known-issues" as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
          Known Issues
        </Link>
        <Link href={"/qa/reports" as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
          Release Quality Report
        </Link>
        <Link href={"/system-health" as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
          System Health
        </Link>
      </nav>

      {query.isLoading ? (
        <InlineLoadingState label="Loading QA dashboard…" />
      ) : scope === "own" ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">You have {String(data?.myOpenIssues ?? 0)} open reported issue(s).</p>
          <Link href={"/qa/issues" as Route} className="mt-3 inline-block text-sm underline">
            View my issues
          </Link>
        </div>
      ) : !isAdmin && scope !== "tenant" ? (
        <PermissionState title="QA access required" description="Contact an administrator for QA dashboard access." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Open Critical", value: data?.openCritical, icon: AlertTriangle, tone: "text-red-700" },
            { label: "Open High", value: data?.openHigh, icon: ShieldAlert, tone: "text-orange-700" },
            { label: "Production Incidents", value: data?.productionIncidents, icon: Bug, tone: "text-amber-700" },
            { label: "Reopened", value: data?.reopened, icon: ClipboardList, tone: "text-slate-700" },
            { label: "Security Issues", value: data?.securityIssues, icon: ShieldAlert, tone: "text-red-600" },
            { label: "Deployment Issues", value: data?.deploymentIssues, icon: Bug, tone: "text-purple-700" },
            { label: "Data Quality", value: data?.dataQualityIssues, icon: ClipboardList, tone: "text-blue-700" },
            { label: "Regression Failed", value: data?.regressionFailed, icon: AlertTriangle, tone: "text-rose-700" }
          ].map((card) => (
            <div key={card.label} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <card.icon className={`h-4 w-4 ${card.tone}`} />
                {card.label}
              </div>
              <p className={`mt-2 text-3xl font-semibold ${card.tone}`}>{String(card.value ?? 0)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
