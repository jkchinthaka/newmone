"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  decideApproval,
  fetchApprovalInbox,
  type ApprovalInboxItem
} from "@/lib/approvals-api";

export default function ApprovalsInboxPage() {
  const [items, setItems] = useState<ApprovalInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApprovalInbox({ page: 1, pageSize: 50 });
      setItems(data.items ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onApprove(id: string) {
    try {
      await decideApproval(id, "APPROVED");
      toast.success("Approved");
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Request failed"));
    }
  }

  async function onReject(id: string) {
    if (rejectReason.trim().length < 3) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      await decideApproval(id, "REJECTED", rejectReason.trim());
      toast.success("Rejected");
      setRejectId(null);
      setRejectReason("");
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Request failed"));
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageBreadcrumbs items={[{ label: "Approvals", href: "/approvals" }]} />
      <ResponsivePageHeader
        title="Pending Approvals"
        description="Decide rule-driven approvals for work orders, retirements, and controlled exceptions."
      />

      {loading ? (
        <div className="flex min-h-40 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading inboxâ€¦
        </div>
      ) : error ? (
        <ErrorState title="Could not load approvals" description={error ?? "Error"} onRetry={() => void refresh()} />
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-600">
          No pending approvals assigned to you.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.processType.replaceAll("_", " ")}</p>
                    <p className="text-xs text-slate-500">
                      {item.subjectEntityType} Â· {item.subjectEntityId.slice(-6)}
                    </p>
                  </div>
                  {item.overdue ? (
                    <span className="text-xs font-medium text-red-600">Overdue</span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Level {item.currentLevel ?? "â€”"} Â· Requested{" "}
                  {new Date(item.requestedAt).toLocaleString()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/approvals/${item.id}` as Route}
                    className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm"
                  >
                    View
                  </Link>
                  <button
                    type="button"
                    className="min-h-10 rounded-lg bg-emerald-600 px-3 text-sm text-white"
                    onClick={() => void onApprove(item.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="min-h-10 rounded-lg border border-red-200 px-3 text-sm text-red-700"
                    onClick={() => setRejectId(item.id)}
                  >
                    Reject
                  </button>
                </div>
                {rejectId === item.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="Rejection reason (required)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <button
                      type="button"
                      className="min-h-10 rounded-lg bg-red-600 px-3 text-sm text-white"
                      onClick={() => void onReject(item.id)}
                    >
                      Confirm reject
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Process</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Requester</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{item.processType.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2">
                      {item.subjectEntityType} / {item.subjectEntityId.slice(-8)}
                    </td>
                    <td className="px-3 py-2">
                      {item.requester
                        ? `${item.requester.firstName ?? ""} ${item.requester.lastName ?? ""}`.trim()
                        : "â€”"}
                    </td>
                    <td className="px-3 py-2">
                      {item.dueAt ? new Date(item.dueAt).toLocaleString() : "â€”"}
                      {item.overdue ? <span className="ml-2 text-red-600">Overdue</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/approvals/${item.id}` as Route} className="text-brand-700 underline">
                          View
                        </Link>
                        <button type="button" className="text-emerald-700" onClick={() => void onApprove(item.id)}>
                          Approve
                        </button>
                        <button type="button" className="text-red-700" onClick={() => setRejectId(item.id)}>
                          Reject
                        </button>
                      </div>
                      {rejectId === item.id ? (
                        <div className="mt-2 flex gap-2">
                          <input
                            className="min-h-10 flex-1 rounded border px-2"
                            placeholder="Rejection reason"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                          />
                          <button
                            type="button"
                            className="rounded bg-red-600 px-3 text-white"
                            onClick={() => void onReject(item.id)}
                          >
                            Confirm
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

