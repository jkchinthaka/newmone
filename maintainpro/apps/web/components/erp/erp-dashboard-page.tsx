"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileUp, GitCompare, Link2, Plug, Settings } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { fetchErpDashboard } from "@/lib/erp-api";

export function ErpDashboardPage() {
  const query = useQuery({ queryKey: ["erp", "dashboard"], queryFn: fetchErpDashboard });
  const data = query.data;

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">ERP Integration Readiness</h2>
        <p className="mt-1 text-sm text-slate-500">
          Bileeta ERP foundation — mock sync and file import only. Live API not configured.
        </p>
      </header>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {String(data?.message ?? "Live ERP API not configured yet — mock and file import modes available")}
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["/erp/status", "Configuration"],
            ["/erp/mapping", "Data Mapping"],
            ["/erp/mock-sync", "Mock Sync"],
            ["/erp/import", "File Import"],
            ["/erp/reconciliation", "Reconciliation"],
            ["/erp/access-checklist", "API Checklist"],
            ["/erp/report", "Report"]
          ] as Array<[string, string]>
        ).map(([href, label]) => (
          <Link key={href} href={href as Route} className="rounded-lg border px-3 py-2 hover:bg-slate-50">
            {label}
          </Link>
        ))}
      </nav>

      {query.isLoading ? (
        <InlineLoadingState label="Loading ERP integration dashboard…" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["Sync Mode", data?.syncMode, Plug],
              ["Credentials", data?.credentialsConfigured ? "Yes" : "No", Settings],
              ["Open Mismatches", data?.openMismatches, GitCompare],
              ["Readiness", data?.readinessVerdict, Link2],
              ["Pending Mappings", data?.pendingMappingFields, Link2],
              ["Reconciliation", data?.reconciliationStatus, AlertTriangle],
              ["Last Mock Sync", data?.lastMockSync ? "Recorded" : "None", Plug],
              ["Last Import", data?.lastFileImport ? "Recorded" : "None", FileUp]
            ] as Array<[string, unknown, typeof Plug]>
          ).map(([label, value, Icon]) => (
            <div key={label} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">{label}</span>
              </div>
              <p className="mt-2 text-lg font-semibold">{String(value ?? "—")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
