"use client";

import { useQuery } from "@tanstack/react-query";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import {
  fetchCutoverChecklist,
  fetchDecisionBoard,
  fetchGoLiveReport,
  fetchLiveIssues,
  fetchPilotRollouts,
  fetchRollbackPlans,
  fetchRolloutWaves,
  fetchSignOffs
} from "@/lib/go-live-api";

function SimpleListPage({ title, queryKey, queryFn, renderItem }: {
  title: string;
  queryKey: string[];
  queryFn: () => Promise<unknown[]>;
  renderItem: (item: Record<string, unknown>) => string;
}) {
  const query = useQuery({ queryKey, queryFn });
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">{title}</h2>
      {query.isLoading ? (
        <InlineLoadingState label={`Loading ${title.toLowerCase()}…`} />
      ) : (
        <ul className="space-y-2">
          {(query.data as Array<Record<string, unknown>>)?.map((item) => (
            <li key={String(item.id ?? item.itemKey ?? item.waveNo)} className="rounded-lg border bg-white p-3 text-sm">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PilotRolloutPage() {
  return (
    <SimpleListPage
      title="Pilot Rollout Plan"
      queryKey={["go-live", "pilots"]}
      queryFn={fetchPilotRollouts}
      renderItem={(p) => `${String(p.pilotName)} — ${String(p.status)} (${String(p.department ?? "all depts")})`}
    />
  );
}

export function CutoverChecklistPage() {
  return (
    <SimpleListPage
      title="Cutover Checklist"
      queryKey={["go-live", "cutover"]}
      queryFn={fetchCutoverChecklist}
      renderItem={(i) => `${String(i.category)}: ${String(i.title)} — ${String(i.status)}`}
    />
  );
}

export function RolloutWavesPage() {
  return (
    <SimpleListPage
      title="Rollout Waves"
      queryKey={["go-live", "waves"]}
      queryFn={fetchRolloutWaves}
      renderItem={(w) => `Wave ${String(w.waveNo)}: ${String(w.waveName)} — ${String(w.status)}`}
    />
  );
}

export function DecisionBoardPage() {
  const query = useQuery({ queryKey: ["go-live", "decision"], queryFn: fetchDecisionBoard });
  const data = query.data as { criteria?: Record<string, unknown>; history?: Array<Record<string, unknown>> } | undefined;
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Go / No-Go Decision Board</h2>
      {query.isLoading ? (
        <InlineLoadingState label="Loading decision board…" />
      ) : (
        <>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm font-medium">Recommended: {String(data?.criteria?.recommendedDecision ?? "—")}</p>
            <p className="mt-2 text-sm text-slate-600">
              Blockers: {(data?.criteria?.blockers as string[] | undefined)?.join(", ") || "None"}
            </p>
          </div>
          <ul className="space-y-2">
            {data?.history?.map((d) => (
              <li key={String(d.id)} className="rounded-lg border bg-white p-3 text-sm">
                {String(d.decision)} — {String(d.reason ?? "no reason")}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function RollbackPlanPage() {
  return (
    <SimpleListPage
      title="Rollback Plan"
      queryKey={["go-live", "rollback"]}
      queryFn={fetchRollbackPlans}
      renderItem={(p) => `${String(p.rollbackPlanNo)} — v${String(p.versionBeforeGoLive)} (${p.active ? "active" : "inactive"})`}
    />
  );
}

export function LiveIssuesPage() {
  const query = useQuery({ queryKey: ["go-live", "issues"], queryFn: fetchLiveIssues });
  const data = query.data as Record<string, unknown> | undefined;
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Live Issue Tracker</h2>
      {query.isLoading ? (
        <InlineLoadingState label="Loading live issues…" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Critical Issues", data?.openCriticalIssues],
              ["High Issues", data?.openHighIssues],
              ["Open Tickets", data?.openSupportTickets],
              ["SLA Breaches", data?.slaBreaches],
              ["Rollback Risk", data?.rollbackRisk]
            ] as Array<[string, unknown]>
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-white p-4">
              <p className="text-xs uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{String(value ?? 0)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SignOffPage() {
  return (
    <SimpleListPage
      title="Management Sign-off"
      queryKey={["go-live", "signoff"]}
      queryFn={fetchSignOffs}
      renderItem={(s) => `${String(s.signOffRole)} — ${String(s.decision)}`}
    />
  );
}

export function GoLiveReportPage() {
  const query = useQuery({ queryKey: ["go-live", "report"], queryFn: fetchGoLiveReport });
  const data = query.data as Record<string, unknown> | undefined;
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Final Go-Live Report</h2>
      {query.isLoading ? (
        <InlineLoadingState label="Generating report…" />
      ) : (
        <pre className="overflow-auto rounded-xl border bg-slate-50 p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}
