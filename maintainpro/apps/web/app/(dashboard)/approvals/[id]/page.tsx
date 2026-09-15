"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { decideApproval, fetchApprovalRequest } from "@/lib/approvals-api";

export default function ApprovalDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const refresh = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchApprovalRequest(params.id));
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load approval"));
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!params.id) return;
    if (decision === "REJECTED" && reason.trim().length < 3) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      await decideApproval(params.id, decision, reason.trim() || undefined);
      toast.success(decision === "APPROVED" ? "Approved" : "Rejected");
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Decision failed"));
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center p-6 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <ErrorState title="Approval not found" description={error ?? "Missing"} onRetry={() => void refresh()} />
      </div>
    );
  }

  const steps = (data.steps as Array<Record<string, unknown>>) ?? [];
  const decisions = (data.decisions as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageBreadcrumbs
        items={[
          { label: "Approvals", href: "/approvals" },
          { label: "Detail", href: `/approvals/${params.id}` }
        ]}
      />
      <ResponsivePageHeader
        title={String(data.processType ?? "Approval").replaceAll("_", " ")}
        description={`${String(data.subjectEntityType)} · ${String(data.subjectEntityId)}`}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Status</h2>
        <p className="mt-1 text-sm text-slate-700">{String(data.status)}</p>
        <p className="mt-1 text-xs text-slate-500">
          Rule version {(data as { triggeredRuleVersion?: number }).triggeredRuleVersion ?? "—"}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Approval chain</h2>
        <ul className="space-y-2 text-sm">
          {steps.map((step) => (
            <li key={String(step.id)} className="flex justify-between gap-2 border-b border-slate-100 pb-2">
              <span>
                Level {String(step.level)} · {String(step.approverRole ?? "User")} · {String(step.status)}
              </span>
              <span className="text-xs text-slate-500">
                {step.dueAt ? `Due ${new Date(String(step.dueAt)).toLocaleString()}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Decisions</h2>
        {decisions.length === 0 ? (
          <p className="text-sm text-slate-500">No decisions yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {decisions.map((d) => (
              <li key={String(d.id)}>
                {String(d.decision)} — {String(d.reason ?? "—")} ·{" "}
                {d.decidedAt ? new Date(String(d.decidedAt)).toLocaleString() : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {String(data.status) === "PENDING" || String(data.status) === "EMERGENCY_OVERRIDE_PENDING_REVIEW" ? (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <textarea
            className="min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Comment / rejection reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm text-white"
              onClick={() => void decide("APPROVED")}
            >
              Approve
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-red-200 px-4 text-sm text-red-700"
              onClick={() => void decide("REJECTED")}
            >
              Reject
            </button>
            <Link href={"/approvals" as Route} className="min-h-11 inline-flex items-center px-3 text-sm">
              Back to inbox
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
