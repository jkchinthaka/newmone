"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, LifeBuoy, Rocket, Timer } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { fetchOperationsDashboard } from "@/lib/operations-api";

export function OperationsDashboardPage() {
  const query = useQuery({ queryKey: ["operations", "dashboard"], queryFn: fetchOperationsDashboard });
  const data = query.data as Record<string, number | string | null | undefined> | undefined;

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Post-Go-Live Operations</h2>
        <p className="mt-1 text-sm text-slate-500">Support, SLA, training, change control, releases, and hypercare.</p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        {[
          ["/post-go-live/training", "Training"],
          ["/support/tickets", "Support Tickets"],
          ["/support/sla", "SLA Monitor"],
          ["/support/escalation", "Escalation"],
          ["/change-requests", "Change Requests"],
          ["/releases", "Releases"],
          ["/post-go-live/monitoring", "Monitoring"],
          ["/post-go-live/hypercare", "Hypercare"],
          ["/post-go-live/handover", "Handover"],
          ["/post-go-live/report", "Report"]
        ].map(([href, label]) => (
          <Link key={href} href={href as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
            {label}
          </Link>
        ))}
      </nav>

      {query.isLoading ? (
        <InlineLoadingState label="Loading operations dashboard…" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Open Tickets", value: data?.openTickets, icon: LifeBuoy },
            { label: "Critical Tickets", value: data?.openCriticalTickets, icon: AlertTriangle },
            { label: "SLA Breaches", value: data?.slaBreaches, icon: Timer },
            { label: "Pending CRs", value: data?.pendingChangeRequests, icon: ClipboardList },
            { label: "Upcoming Releases", value: data?.upcomingReleases, icon: Rocket },
            { label: "Training Complete", value: `${data?.trainingCompletionPercentage ?? 0}%`, icon: ClipboardList }
          ].map((card) => (
            <div key={card.label} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <card.icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">{card.label}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{String(card.value ?? 0)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
