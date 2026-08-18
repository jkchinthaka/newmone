"use client";

import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { FgSubnav } from "@/components/fg/fg-subnav";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-state";
import { decideFgQa, decideFgReview, fetchFgQa, fetchFgQaQueue, fetchFgReview, fetchFgReviews } from "@/lib/fg-api";
import { stableActionKey } from "@/lib/fg-mappers";

type Mode = "review" | "qa";

export default function FgQueueWorkspace({ mode }: { mode: Mode }) {
  const params = useParams<{ id?: string }>();
  const selectedId = params?.id;
  const [rows, setRows] = useState<Array<{ id: string; formCode: string; formTitle: string; batchReference: string; submittedAt: string | null }>>([]);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const list = mode === "review" ? fetchFgReviews() : fetchFgQaQueue();
    void list
      .then((result) => {
        if (result.error) {
          setError(result.error.message);
          return;
        }
        setRows(result.data?.submissions ?? []);
      })
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const request = mode === "review" ? fetchFgReview(selectedId) : fetchFgQa(selectedId);
    void request.then((result) => {
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setDetail(result.data ?? null);
    });
  }, [mode, selectedId]);

  const actions = (detail?.actions as { canDecide?: boolean; decisions?: string[] } | undefined) ?? {};
  const selfReview = detail?.selfReview as { blocked?: boolean; message?: string } | undefined;

  async function decide(decision: string) {
    if (!selectedId || pending) return;
    setPending(decision);
    const payload = {
      decision,
      reviewNote: note,
      idempotencyKey: stableActionKey(`${mode}:${decision}`, selectedId)
    };
    const result =
      mode === "review" ? await decideFgReview(selectedId, payload) : await decideFgQa(selectedId, payload);
    setPending("");
    if (result.error) {
      setError(result.error.message);
      return;
    }
    load();
    const refreshed = mode === "review" ? await fetchFgReview(selectedId) : await fetchFgQa(selectedId);
    setDetail(refreshed.data ?? null);
  }

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          {mode === "review" ? "Supervisor review" : "QA verification"}
        </h1>
        <p className="text-sm text-slate-600">
          {mode === "review"
            ? "Approve or return submitted controlled records. Server authorization remains mandatory."
            : "Record RELEASE, HOLD, or REJECT. This does not change ERP, inventory, or CAPA."}
        </p>
      </header>
      <FgSubnav />
      {loading ? <LoadingState title="Loading queue" /> : null}
      {!loading && error ? <ErrorState description={error} onRetry={load} /> : null}
      {!loading && !error && rows.length === 0 && !selectedId ? (
        <EmptyState title={mode === "review" ? "No records waiting for supervisor review" : "No records waiting for QA"} />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={(mode === "review" ? `/fg/review/${row.id}` : `/fg/qa/${row.id}`) as Route}
                className={`block rounded-xl border p-3 ${selectedId === row.id ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"}`}
              >
                <p className="text-xs font-semibold text-slate-500">{row.formCode}</p>
                <p className="font-semibold text-slate-900">{row.formTitle}</p>
                <p className="text-xs text-slate-500">{row.batchReference}</p>
              </Link>
            </li>
          ))}
        </ul>
        {selectedId && detail ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            {selfReview?.blocked ? (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
                {selfReview.message || "Self-review is not permitted for this record."}
              </p>
            ) : null}
            <label className="block text-sm font-medium text-slate-700" htmlFor="fg-review-note">
              Review note
            </label>
            <textarea
              id="fg-review-note"
              className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 p-3 text-sm"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {(actions.decisions ?? []).map((decision) => (
                <button
                  key={decision}
                  type="button"
                  disabled={!actions.canDecide || Boolean(pending)}
                  className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => void decide(decision)}
                >
                  {pending === decision ? "Saving…" : decision.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
