"use client";

import { useQuery } from "@tanstack/react-query";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import {
  fetchChangeRequests,
  fetchHypercarePlans,
  fetchMonitoringDashboard,
  fetchPostGoLiveReport,
  fetchReleases,
  fetchSupportHandover,
  fetchTrainingSessions
} from "@/lib/operations-api";

export function TrainingTrackerPage() {
  const query = useQuery({ queryKey: ["operations", "training"], queryFn: fetchTrainingSessions });
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Training Tracker</h2>
      {query.isLoading ? <InlineLoadingState label="Loading training…" /> : (
        <ul className="space-y-2">{(query.data as Array<Record<string, unknown>>)?.map((s) => (
          <li key={String(s.id)} className="rounded border bg-white p-3 text-sm">{String(s.trainingSessionNo)} — {String(s.role)} — {String(s.status)}</li>
        ))}</ul>
      )}
    </div>
  );
}

export function ChangeRequestsPage() {
  const query = useQuery({ queryKey: ["operations", "change-requests"], queryFn: fetchChangeRequests });
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Change Requests</h2>
      {query.isLoading ? <InlineLoadingState label="Loading change requests…" /> : (
        <ul className="space-y-2">{(query.data as Array<Record<string, unknown>>)?.map((cr) => (
          <li key={String(cr.id)} className="rounded border bg-white p-3 text-sm">{String(cr.crNo)} — {String(cr.title)} — {String(cr.status)}</li>
        ))}</ul>
      )}
    </div>
  );
}

export function ReleasesPage() {
  const query = useQuery({ queryKey: ["operations", "releases"], queryFn: fetchReleases });
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Release Notes</h2>
      {query.isLoading ? <InlineLoadingState label="Loading releases…" /> : (
        <ul className="space-y-2">{(query.data as Array<Record<string, unknown>>)?.map((r) => (
          <li key={String(r.id)} className="rounded border bg-white p-3 text-sm">{String(r.releaseNo)} v{String(r.version)} — {String(r.status)}</li>
        ))}</ul>
      )}
    </div>
  );
}

export function MonitoringPage() {
  const query = useQuery({ queryKey: ["operations", "monitoring"], queryFn: fetchMonitoringDashboard });
  const data = query.data as Record<string, unknown> | undefined;
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Production Monitoring</h2>
      {query.isLoading ? <InlineLoadingState label="Loading monitoring…" /> : (
        <div className="rounded-xl border bg-white p-4 text-sm">
          <p>API: {String((data?.apiHealth as Record<string, unknown>)?.status ?? "unknown")}</p>
          <p>Open critical tickets: {String(data?.openCriticalTickets ?? 0)}</p>
          <p>Current release: {String(data?.currentReleaseVersion ?? "none")}</p>
        </div>
      )}
    </div>
  );
}

export function HypercarePage() {
  const query = useQuery({ queryKey: ["operations", "hypercare"], queryFn: fetchHypercarePlans });
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Hypercare Plan</h2>
      {query.isLoading ? <InlineLoadingState label="Loading hypercare…" /> : (
        <ul className="space-y-2">{(query.data as Array<Record<string, unknown>>)?.map((h) => (
          <li key={String(h.id)} className="rounded border bg-white p-3 text-sm">{String(h.hypercarePeriodName)} — {String(h.readinessStatus)}</li>
        ))}</ul>
      )}
    </div>
  );
}

export function HandoverPage() {
  const query = useQuery({ queryKey: ["operations", "handover"], queryFn: fetchSupportHandover });
  const doc = query.data ?? {};
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Support Handover</h2>
      {query.isLoading ? <InlineLoadingState label="Loading handover pack…" /> : (
        <div className="space-y-4">
          {Object.entries(doc).filter(([k]) => !["id", "tenantId", "createdAt", "updatedAt", "updatedByUserId"].includes(k)).map(([k, v]) => (
            <section key={k} className="rounded-xl border bg-white p-4">
              <h3 className="text-sm font-semibold capitalize">{k.replace(/([A-Z])/g, " $1")}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{String(v ?? "")}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function PostGoLiveReportPage() {
  const query = useQuery({ queryKey: ["operations", "report"], queryFn: fetchPostGoLiveReport });
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Post-Go-Live Report</h2>
      {query.isLoading ? <InlineLoadingState label="Generating report…" /> : (
        <pre className="overflow-auto rounded-xl border bg-slate-50 p-4 text-xs">{JSON.stringify(query.data, null, 2)}</pre>
      )}
    </div>
  );
}
