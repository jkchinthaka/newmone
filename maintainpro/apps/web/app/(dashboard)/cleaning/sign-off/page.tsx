"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageSquareText, Star, XCircle } from "lucide-react";

import { apiClient } from "@/lib/api-client";

interface ChecklistItem {
  label: string;
  checked: boolean;
  note?: string;
}

interface VisitRow {
  id: string;
  scannedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number | null;
  notes?: string;
  status: string;
  qualityScore?: number | null;
  beforePhotos: string[];
  afterPhotos: string[];
  location: { name: string; area: string };
  cleaner: { firstName: string; lastName: string };
  checklist?: { items: ChecklistItem[] } | null;
}

type ReviewState = {
  rating: number;
  comment: string;
  rejectionReason: string;
};

function durationText(row: VisitRow) {
  if (row.durationSeconds && row.durationSeconds > 0) {
    const minutes = Math.round((row.durationSeconds / 60) * 10) / 10;
    return `${minutes} min`;
  }

  if (row.startedAt && row.completedAt) {
    const started = new Date(row.startedAt).getTime();
    const completed = new Date(row.completedAt).getTime();
    const minutes = Math.max(0, Math.round(((completed - started) / 60000) * 10) / 10);
    return `${minutes} min`;
  }

  return "-";
}

export default function SignOffPage() {
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewByVisit, setReviewByVisit] = useState<Record<string, ReviewState>>({});

  const load = useCallback(() => {
    apiClient
      .get("/cleaning/visits", { params: { status: "SUBMITTED" } })
      .then((res) => {
        const items = (res.data?.data?.items ?? res.data?.data ?? []) as VisitRow[];
        setRows(items);

        setReviewByVisit((current) => {
          const next = { ...current };
          items.forEach((visit) => {
            if (!next[visit.id]) {
              next[visit.id] = {
                rating: 4,
                comment: "",
                rejectionReason: ""
              };
            }
          });
          return next;
        });
      })
      .catch((err: { response?: { data?: { message?: string } } }) => {
        setError(err?.response?.data?.message ?? "Failed to load sign-off queue");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, approve: boolean) => {
    const review = reviewByVisit[id] ?? {
      rating: 4,
      comment: "",
      rejectionReason: ""
    };

    if (!approve && !review.rejectionReason.trim()) {
      setError("Rejection reason is required when rejecting a visit.");
      return;
    }

    setBusyId(id);
    setError(null);

    try {
      await apiClient.post(`/cleaning/visits/${id}/sign-off`, {
        approve,
        notes: review.comment || undefined,
        rating: review.rating,
        rejectionReason: approve ? undefined : review.rejectionReason
      });
      load();
    } catch (err) {
      const typedError = err as { response?: { data?: { message?: string } } };
      setError(typedError?.response?.data?.message ?? "Failed to submit sign-off decision");
    } finally {
      setBusyId(null);
    }
  };

  const totals = useMemo(
    () => ({
      pendingCount: rows.length,
      avgQuality:
        rows.length === 0
          ? 0
          : Math.round(
              rows.reduce((acc, row) => acc + (row.qualityScore ?? 0), 0) / rows.length
            )
    }),
    [rows]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Supervisor Sign-off</h1>
        <p className="text-sm text-slate-600">
          Review photo evidence, checklist quality, and time spent before approving visits.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Pending reviews: {totals.pendingCount}
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
            Avg quality: {totals.avgQuality}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No visits awaiting sign-off.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((visit) => {
            const review =
              reviewByVisit[visit.id] ??
              ({ rating: 4, comment: "", rejectionReason: "" } as ReviewState);
            const checkedCount = visit.checklist?.items?.filter((item) => item.checked).length ?? 0;
            const totalChecklist = visit.checklist?.items?.length ?? 0;

            return (
              <div key={visit.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{visit.location.name}</div>
                    <div className="text-xs text-slate-500">
                      {visit.location.area} · {new Date(visit.scannedAt).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Cleaner: {visit.cleaner.firstName} {visit.cleaner.lastName}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        Checklist: {checkedCount}/{totalChecklist}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        Duration: {durationText(visit)}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                        Quality: {visit.qualityScore ?? "-"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      disabled={busyId === visit.id}
                      onClick={() => void decide(visit.id, true)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button
                      disabled={busyId === visit.id}
                      onClick={() => void decide(visit.id, false)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <PhotoStrip title="Before" urls={visit.beforePhotos} />
                  <PhotoStrip title="After" urls={visit.afterPhotos} />
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[0.6fr_1fr]">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rating</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Star size={14} className="text-amber-500" />
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={review.rating}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setReviewByVisit((current) => ({
                            ...current,
                            [visit.id]: {
                              ...review,
                              rating: value
                            }
                          }));
                        }}
                        className="w-full"
                      />
                      <span className="text-sm font-semibold text-slate-700">{review.rating}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <MessageSquareText size={12} /> Supervisor comment
                    </p>
                    <textarea
                      value={review.comment}
                      onChange={(event) => {
                        const value = event.target.value;
                        setReviewByVisit((current) => ({
                          ...current,
                          [visit.id]: {
                            ...review,
                            comment: value
                          }
                        }));
                      }}
                      rows={2}
                      placeholder="Comment for cleaner"
                      className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <input
                      value={review.rejectionReason}
                      onChange={(event) => {
                        const value = event.target.value;
                        setReviewByVisit((current) => ({
                          ...current,
                          [visit.id]: {
                            ...review,
                            rejectionReason: value
                          }
                        }));
                      }}
                      placeholder="Rejection reason (required for reject)"
                      className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                </div>

                {visit.notes ? (
                  <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                    Cleaner notes: {visit.notes}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PhotoStrip({ title, urls }: { title: string; urls: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="flex gap-2 overflow-x-auto">
        {urls.length === 0 ? (
          <span className="text-xs text-slate-400">No photos</span>
        ) : (
          urls.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${title}-${index}`}
              src={url}
              alt={`${title}-${index}`}
              className="h-24 w-24 rounded-md object-cover"
            />
          ))
        )}
      </div>
    </div>
  );
}
