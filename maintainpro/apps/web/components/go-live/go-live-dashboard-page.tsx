"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Flag, Rocket, Shield } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { fetchGoLiveDashboard } from "@/lib/go-live-api";

export function GoLiveDashboardPage() {
  const query = useQuery({ queryKey: ["go-live", "dashboard"], queryFn: fetchGoLiveDashboard });
  const data = query.data as Record<string, string | number | null | undefined> | undefined;

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Go-Live Control Center</h2>
        <p className="mt-1 text-sm text-slate-500">Pilot rollout, cutover checklist, waves, go/no-go, and sign-off.</p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["/go-live/pilot", "Pilot Rollout"],
            ["/go-live/cutover", "Cutover Checklist"],
            ["/go-live/waves", "Rollout Waves"],
            ["/go-live/decision", "Go / No-Go"],
            ["/go-live/rollback", "Rollback Plan"],
            ["/go-live/issues", "Live Issues"],
            ["/go-live/signoff", "Sign-off"],
            ["/go-live/report", "Final Report"]
          ] as Array<[string, string]>
        ).map(([href, label]) => (
          <Link key={href} href={href as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
            {label}
          </Link>
        ))}
      </nav>

      {query.isLoading ? (
        <InlineLoadingState label="Loading go-live dashboard…" />
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Readiness Verdict</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{String(data?.readinessVerdict ?? "NOT_READY")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["Pilot Status", data?.pilotStatus, Rocket],
                ["Cutover Complete", `${data?.cutoverCompletionPercentage ?? 0}%`, CheckCircle2],
                ["Critical Blockers", data?.openCriticalBlockers, AlertTriangle],
                ["Backup Status", data?.backupStatus, Shield],
                ["Rollback Status", data?.rollbackStatus, Flag],
                ["Sign-off Status", data?.signOffStatus, CheckCircle2],
                ["Wave Status", data?.rolloutWaveStatus, Rocket],
                ["Latest Decision", data?.latestDecision ?? "—", Flag]
              ] as Array<[string, string | number | null | undefined, typeof Rocket]>
            ).map(([label, value, Icon]) => (
              <div key={label} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase">{label}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold">{String(value ?? "—")}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
