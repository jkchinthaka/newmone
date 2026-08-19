"use client";

import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { FgRecordForm } from "@/components/fg/fg-record-form";
import { FgStatusBadge } from "@/components/fg/fg-status-badge";
import { FgSubnav } from "@/components/fg/fg-subnav";
import { FgWorkflowTimeline } from "@/components/fg/fg-workflow-timeline";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { fetchFgRecord } from "@/lib/fg-api";
import { djangoPrintHref } from "@/lib/fg-mappers";
import type { FgRecordDetail } from "@/lib/fg-types";

export default function FgRecordPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [detail, setDetail] = useState<FgRecordDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    void fetchFgRecord(id)
      .then((result) => {
        if (result.error || !result.data) {
          setError(result.error?.message || "Unable to load this record.");
          setDetail(null);
          return;
        }
        setDetail(result.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <FgSubnav />
      {loading ? <LoadingState title="Loading record" /> : null}
      {!loading && error ? <ErrorState description={error} onRetry={load} /> : null}
      {!loading && detail ? (
        <>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{detail.record.formCode}</p>
              <h1 className="text-2xl font-semibold text-slate-900">{detail.record.formTitle}</h1>
              <p className="mt-1 text-sm text-slate-600">{detail.record.batchReference}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FgStatusBadge label={detail.readOnly ? "READ ONLY" : detail.record.statusLabel} />
              {detail.readOnly ? <FgStatusBadge label="COMPLETED" /> : null}
              <a
                href={djangoPrintHref(detail.record.printPath)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700"
              >
                Print
              </a>
            </div>
          </header>
          <FgWorkflowTimeline statusLabel={detail.record.statusLabel} recordStatus={detail.record.status} />
          {detail.snapshot?.length ? (
            <div className="space-y-4">
              {detail.snapshot.map((section) => (
                <section key={section.title} className="rounded-xl border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
                  <dl className="mt-3 grid gap-2">
                    {(section.items ?? []).map((item) => (
                      <div key={`${item.code}-${item.label}`} className="grid gap-1 sm:grid-cols-[12rem_1fr]">
                        <dt className="text-sm text-slate-500">{item.label}</dt>
                        <dd className="text-sm font-medium text-slate-900">{item.value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          ) : (
            <FgRecordForm detail={detail} onRefresh={load} />
          )}
          <p className="text-sm text-slate-500">
            <Link href={"/fg/history" as Route} className="font-semibold text-brand-700">
              Record history
            </Link>
          </p>
        </>
      ) : null}
    </div>
  );
}
