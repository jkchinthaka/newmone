"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";
import { useCurrentUser } from "@/lib/use-current-user";

import { formatDateTime } from "./helpers";
import { InventorySectionNav } from "./inventory-section-nav";

type UnverifiedIssue = {
  id: string;
  issuedAt: string;
  issuedById: string | null;
  issuedByName: string | null;
  partName: string | null;
  partNumber: string | null;
  erpCode: string | null;
  quantity: number;
  woNumber: string | null;
  note: string | null;
  review: { outcome: string | null; note: string | null; reviewedByName: string | null; reviewedAt: string } | null;
};

type View = "open" | "reviewed" | "all";

const VIEWS: Array<{ value: View; label: string }> = [
  { value: "open", label: "To check" },
  { value: "reviewed", label: "Checked" },
  { value: "all", label: "All" }
];

const OUTCOME_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed — part really left the store",
  NEEDS_FOLLOW_UP: "Needs follow-up"
};

/**
 * Parts issued to a job when the part had no verified ERP stock. The issue was allowed so the job
 * was not stopped; stores or admin confirm each one here, or flag it for follow-up.
 */
export default function UnverifiedIssuesPage() {
  const qc = useQueryClient();
  const user = useCurrentUser();
  const [view, setView] = useState<View>("open");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queryKey = withTenantScope(["inventory", "unverified-issues", view]);

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiClient.get<{ data: { openCount: number; items: UnverifiedIssue[] } }>(
        "/inventory/unverified-issues",
        { params: { view } }
      );
      return res.data.data;
    }
  });

  const review = useMutation({
    mutationFn: async (input: { id: string; outcome: "CONFIRMED" | "NEEDS_FOLLOW_UP" }) => {
      await apiClient.post(`/inventory/unverified-issues/${input.id}/review`, {
        outcome: input.outcome,
        note: notes[input.id]?.trim() || undefined
      });
    },
    onSuccess: () => {
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: withTenantScope(["inventory", "unverified-issues"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not save."))
  });

  return (
    <div className="ops-page space-y-4">
      <PageBreadcrumbs />
      <InventorySectionNav />
      <div>
        <h1 className="page-title">Check part issues</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          These parts were given to a job when the system had no checked stock for them from the ERP. Check
          each one: confirm the part really left the store, or flag it so stores can follow up. The person who
          issued a part cannot check their own issue.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter">
        {VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={view === option.value}
            onClick={() => setView(option.value)}
            className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${
              view === option.value ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {option.label}
            {option.value === "open" && listQuery.data ? ` (${listQuery.data.openCount})` : ""}
          </button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <LoadingState title="Loading part issues" description="Fetching parts issued without checked stock." />
      ) : listQuery.isError ? (
        <ErrorState
          title="Unable to load part issues"
          description={getApiErrorMessage(listQuery.error, "Request failed")}
          onRetry={() => listQuery.refetch()}
        />
      ) : (listQuery.data?.items ?? []).length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          {view === "open" ? "Nothing to check. Every part issue has been checked." : "No part issues here."}
        </p>
      ) : (
        <ul className="space-y-3">
          {(listQuery.data?.items ?? []).map((item) => {
            const ownIssue = Boolean(user.id && item.issuedById === user.id);
            return (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {item.quantity} × {item.partName ?? "Part"}{" "}
                      <span className="font-mono text-xs text-slate-500">{item.partNumber ?? item.erpCode ?? ""}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      Job {item.woNumber ?? "—"} · issued by {item.issuedByName ?? "—"} · {formatDateTime(item.issuedAt)}
                    </p>
                    {item.note ? <p className="mt-1 text-sm text-slate-600">Note: {item.note}</p> : null}
                  </div>
                  {item.review ? (
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        item.review.outcome === "CONFIRMED" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {OUTCOME_LABELS[item.review.outcome ?? ""] ?? item.review.outcome}
                    </span>
                  ) : null}
                </div>
                {item.review ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Checked by {item.review.reviewedByName ?? "—"} on {formatDateTime(item.review.reviewedAt)}
                    {item.review.note ? ` — ${item.review.note}` : ""}
                  </p>
                ) : ownIssue ? (
                  <p className="mt-2 text-xs text-slate-500">You issued this part, so someone else must check it.</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className="min-h-10 flex-1 rounded border border-slate-300 px-3 text-sm"
                      placeholder="Note (needed for follow-up)"
                      value={notes[item.id] ?? ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                    <button
                      type="button"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ id: item.id, outcome: "CONFIRMED" })}
                      className="min-h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={review.isPending || (notes[item.id]?.trim().length ?? 0) < 5}
                      onClick={() => review.mutate({ id: item.id, outcome: "NEEDS_FOLLOW_UP" })}
                      className="min-h-10 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-900 disabled:opacity-60"
                    >
                      Needs follow-up
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
