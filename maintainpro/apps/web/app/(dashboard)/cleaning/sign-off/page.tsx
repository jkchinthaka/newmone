"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

interface ChecklistItem {
  label: string;
  checked: boolean;
  note?: string;
}
interface VisitRow {
  id: string;
  scannedAt: string;
  notes?: string;
  status: string;
  beforePhotos: string[];
  afterPhotos: string[];
  location: { name: string; area: string };
  cleaner: { firstName: string; lastName: string };
  checklist?: { items: ChecklistItem[] } | null;
}

export default function SignOffPage() {
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient
      .get("/cleaning/visits", { params: { status: "SUBMITTED" } })
      .then((res) => setRows(res.data?.data ?? res.data ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, approve: boolean) => {
    const reason = approve
      ? undefined
      : window.prompt("Rejection reason?") ?? undefined;
    if (!approve && !reason) return;

    setBusyId(id);
    try {
      await apiClient.post(`/cleaning/visits/${id}/sign-off`, {
        approve,
        rejectionReason: reason
      });
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Sign-off Queue</h1>
        <p className="text-sm text-slate-600">
          Review submitted cleaning visits and approve or reject them.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          🎉 No visits awaiting sign-off.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((v) => (
            <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">{v.location.name}</div>
                  <div className="text-xs text-slate-500">
                    {v.location.area} · {new Date(v.scannedAt).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    By {v.cleaner.firstName} {v.cleaner.lastName}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busyId === v.id}
                    onClick={() => decide(v.id, false)}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    disabled={busyId === v.id}
                    onClick={() => decide(v.id, true)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>

              {v.checklist?.items?.length ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {v.checklist.items.map((item, idx) => (
                    <li
                      key={idx}
                      className={item.checked ? "text-emerald-700" : "text-slate-500"}
                    >
                      {item.checked ? "✅" : "⚪"} {item.label}
                      {item.note ? <span className="ml-2 text-xs italic">({item.note})</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {v.notes ? (
                <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                  Notes: {v.notes}
                </p>
              ) : null}

              {(v.beforePhotos?.length || v.afterPhotos?.length) ? (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <PhotoStrip title="Before" urls={v.beforePhotos} />
                  <PhotoStrip title="After" urls={v.afterPhotos} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoStrip({ title, urls }: { title: string; urls: string[] }) {
  return (
    <div>
      <p className="mb-1 font-medium text-slate-600">{title}</p>
      <div className="flex gap-2 overflow-x-auto">
        {urls.length === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          urls.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={u}
              alt={`${title}-${i}`}
              className="h-20 w-20 rounded-md object-cover"
            />
          ))
        )}
      </div>
    </div>
  );
}
