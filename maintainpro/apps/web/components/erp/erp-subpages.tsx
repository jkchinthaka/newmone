"use client";

import { useQuery } from "@tanstack/react-query";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import {
  fetchErpAccessChecklist,
  fetchErpImportBatches,
  fetchErpMappings,
  fetchErpMockStatus,
  fetchErpReconciliation,
  fetchErpReport,
  fetchErpStatus
} from "@/lib/erp-api";

function SimpleList({ title, queryKey, queryFn, render }: {
  title: string;
  queryKey: string[];
  queryFn: () => Promise<unknown>;
  render: (data: unknown) => string;
}) {
  const query = useQuery({ queryKey, queryFn });
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">{title}</h2>
      {query.isLoading ? (
        <InlineLoadingState label={`Loading ${title.toLowerCase()}…`} />
      ) : (
        <pre className="overflow-auto rounded-xl border bg-slate-50 p-4 text-xs">{render(query.data)}</pre>
      )}
    </div>
  );
}

export function ErpStatusPage() {
  return (
    <SimpleList
      title="ERP Configuration Status"
      queryKey={["erp", "status"]}
      queryFn={fetchErpStatus}
      render={(d) => JSON.stringify(d, null, 2)}
    />
  );
}

export function ErpMappingPage() {
  const query = useQuery({ queryKey: ["erp", "mappings"], queryFn: fetchErpMappings });
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Data Mapping</h2>
      {query.isLoading ? (
        <InlineLoadingState label="Loading mappings…" />
      ) : (
        <ul className="space-y-2">
          {(query.data as Array<Record<string, string>>)?.map((m) => (
            <li key={m.id} className="rounded-lg border bg-white p-3 text-sm">
              {m.sourceField} → {m.targetModel}.{m.targetField} {m.active ? "" : "(inactive)"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ErpMockSyncPage() {
  return (
    <SimpleList
      title="Mock Sync"
      queryKey={["erp", "mock"]}
      queryFn={fetchErpMockStatus}
      render={(d) => JSON.stringify(d, null, 2)}
    />
  );
}

export function ErpImportPage() {
  const query = useQuery({ queryKey: ["erp", "imports"], queryFn: fetchErpImportBatches });
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">File Import</h2>
      <p className="text-sm text-slate-500">Non-production ERP data — requires dry-run and approval before apply.</p>
      {query.isLoading ? (
        <InlineLoadingState label="Loading import batches…" />
      ) : (
        <ul className="space-y-2">
          {(query.data as Array<Record<string, string>>)?.map((b) => (
            <li key={b.id} className="rounded-lg border bg-white p-3 text-sm">
              {b.batchNo} — {b.importType} — {b.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ErpReconciliationPage() {
  const query = useQuery({ queryKey: ["erp", "reconciliation"], queryFn: fetchErpReconciliation });
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Reconciliation Report</h2>
      {query.isLoading ? (
        <InlineLoadingState label="Loading mismatches…" />
      ) : (
        <ul className="space-y-2">
          {(query.data as Array<Record<string, string>>)?.map((m) => (
            <li key={m.id} className="rounded-lg border bg-white p-3 text-sm">
              [{m.severity}] {m.reportType}: {m.sourceRecordCode} — {m.fieldName} ERP={m.erpValue} MP={m.maintainProValue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ErpAccessChecklistPage() {
  const query = useQuery({ queryKey: ["erp", "checklist"], queryFn: fetchErpAccessChecklist });
  const data = query.data as { verdict?: string; items?: Array<Record<string, string>> } | undefined;
  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <h2 className="text-2xl font-semibold">Bileeta API Access Checklist</h2>
      <p className="text-sm font-medium">Verdict: {data?.verdict ?? "WAITING_FOR_BILEETA"}</p>
      {query.isLoading ? (
        <InlineLoadingState label="Loading checklist…" />
      ) : (
        <ul className="space-y-2">
          {data?.items?.map((item) => (
            <li key={item.id} className="rounded-lg border bg-white p-3 text-sm">
              {item.title} — {item.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ErpReportPage() {
  return (
    <SimpleList
      title="ERP Integration Report"
      queryKey={["erp", "report"]}
      queryFn={fetchErpReport}
      render={(d) => JSON.stringify(d, null, 2)}
    />
  );
}
