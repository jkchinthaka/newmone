"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { extractRoleName } from "@/lib/role-redirect";
import {
  approveRequest,
  cancelRequest,
  convertRequestToWorkOrder,
  fetchDuplicateCandidates,
  getMaintenanceRequest,
  markRequestDuplicate,
  rejectRequest,
  requestMoreInformation,
  resumeRequestReview,
  startRequestReview,
  triageRequest,
  type MaintenanceRequestListItem
} from "@/lib/maintenance-requests-api";

const TRIAGE_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "ASSET_MANAGER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR"
]);

type Detail = Record<string, unknown> & {
  id: string;
  requestNumber: string;
  status: string;
  statusLabel?: string;
  priority: string;
  description: string;
  affectsOperation?: boolean;
  isEmergency?: boolean;
  reportedAt?: string;
  failureNoticedAt?: string | null;
  triageNotes?: string | null;
  publicUpdateNote?: string | null;
  workOrderId?: string | null;
  workOrder?: { id: string; woNumber: string; status?: string } | null;
  asset?: { id: string; assetTag: string; name: string } | null;
  site?: { id: string; code: string; name: string } | null;
  functionalLocation?: { id: string; code: string; name: string } | null;
  domain?: { id: string; code: string; name: string } | null;
  problemCategory?: { name: string } | null;
  problemCategoryLabel?: string | null;
  reportedBy?: { id: string; name: string; email?: string } | null;
  contextSnapshot?: Record<string, unknown> | null;
  history?: Array<{
    id: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    reason?: string | null;
    createdAt: string;
    isInternal?: boolean;
    actor?: { name?: string } | null;
  }>;
};

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const user = useCurrentUser();
  const role = extractRoleName({ role: user.role });
  const canTriage = role != null && TRIAGE_ROLES.has(role);
  const isOwner = (detail: Detail | null) =>
    detail?.reportedBy?.id && user.id && detail.reportedBy.id === user.id;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectType, setRejectType] = useState("INVALID_REQUEST");
  const [infoQuestion, setInfoQuestion] = useState("");
  const [resumeNote, setResumeNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [triageNotes, setTriageNotes] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dupes, setDupes] = useState<MaintenanceRequestListItem[]>([]);
  const [canonicalDupId, setCanonicalDupId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await getMaintenanceRequest(id)) as Detail;
      setDetail(data);
      setPriority(String(data.priority || "MEDIUM"));
      setTriageNotes(String(data.triageNotes || ""));
      if (canTriage) {
        try {
          const d = await fetchDuplicateCandidates(id);
          setDupes(d.items || []);
        } catch {
          setDupes([]);
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load request."));
    } finally {
      setLoading(false);
    }
  }, [id, canTriage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Action failed."));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-500">
        <Loader2 className="animate-spin" size={16} /> Loading request…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-6">
        <ErrorState title="Request unavailable" description={error || "Not found"} />
      </div>
    );
  }

  const snapshot = detail.contextSnapshot || {};
  const publicHistory = (detail.history || []).filter((h) => canTriage || !h.isInternal);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs />
      <ResponsivePageHeader
        title={detail.requestNumber}
        description={detail.statusLabel || detail.status}
        actions={
          detail.workOrder ? (
            <Link
              href={`/work-orders/${detail.workOrder.id}` as Route}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm"
            >
              WO {detail.workOrder.woNumber}
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide">
              <span className="rounded bg-slate-100 px-2 py-1">{detail.priority}</span>
              <span className="rounded bg-brand-50 px-2 py-1 text-brand-800">
                {detail.statusLabel || detail.status}
              </span>
              {detail.affectsOperation ? (
                <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">Operation stopped</span>
              ) : null}
              {detail.isEmergency ? (
                <span className="rounded bg-red-100 px-2 py-1 text-red-800">Emergency</span>
              ) : null}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{detail.description}</p>
            {detail.publicUpdateNote ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Latest update: {detail.publicUpdateNote}
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <h2 className="mb-2 font-semibold">Asset / location</h2>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Asset</dt>
                <dd>
                  {detail.asset
                    ? `${detail.asset.name} (${detail.asset.assetTag})`
                    : String(snapshot.assetName || "—")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Site</dt>
                <dd>{detail.site?.name || String(snapshot.siteName || "—")}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Functional location</dt>
                <dd>
                  {detail.functionalLocation?.name ||
                    String(snapshot.functionalLocationName || "—")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Location path (at report)</dt>
                <dd>{String(snapshot.locationPath || "—")}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Domain</dt>
                <dd>{detail.domain?.name || String(snapshot.domainName || "—")}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd>
                  {detail.problemCategory?.name || detail.problemCategoryLabel || "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-semibold">Timeline</h2>
            <ul className="space-y-2 text-sm">
              {publicHistory.map((h) => (
                <li key={h.id} className="border-l-2 border-slate-200 pl-3">
                  <div className="font-medium">{h.action}</div>
                  <div className="text-xs text-slate-500">
                    {h.fromStatus ? `${h.fromStatus} → ` : ""}
                    {h.toStatus || ""} · {new Date(h.createdAt).toLocaleString()}
                    {h.actor?.name ? ` · ${h.actor.name}` : ""}
                  </div>
                  {h.reason ? <div className="text-slate-600">{h.reason}</div> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <h2 className="mb-2 font-semibold">Reported</h2>
            <p>{detail.reportedBy?.name || "—"}</p>
            <p className="text-slate-500">
              {detail.reportedAt ? new Date(detail.reportedAt).toLocaleString() : "—"}
            </p>
            {detail.failureNoticedAt ? (
              <p className="mt-2 text-slate-500">
                Noticed: {new Date(detail.failureNoticedAt).toLocaleString()}
              </p>
            ) : null}
          </section>

          {isOwner(detail) && ["NEW", "UNDER_REVIEW"].includes(detail.status) ? (
            <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">Cancel my request</h2>
              <input
                className="min-h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="Cancellation reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || cancelReason.trim().length < 3}
                className="min-h-11 w-full rounded-lg border border-red-200 text-sm text-red-700 disabled:opacity-40"
                onClick={() =>
                  void run(() => cancelRequest(id, cancelReason.trim()), "Request cancelled")
                }
              >
                Cancel request
              </button>
            </section>
          ) : null}

          {canTriage ? (
            <section className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
              <h2 className="font-semibold text-brand-950">Supervisor triage</h2>
              {detail.status === "NEW" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 w-full rounded-lg bg-brand-600 text-sm text-white"
                  onClick={() => void run(() => startRequestReview(id), "Review started")}
                >
                  Start review
                </button>
              ) : null}

              {["UNDER_REVIEW", "APPROVED"].includes(detail.status) ? (
                <>
                  <label className="block text-sm">
                    Priority
                    <select
                      className="mt-1 min-h-11 w-full rounded-lg border px-3"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </label>
                  <textarea
                    className="min-h-20 w-full rounded-lg border p-2 text-sm"
                    placeholder="Internal triage notes (not shown to requesters)"
                    value={triageNotes}
                    onChange={(e) => setTriageNotes(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 w-full rounded-lg border bg-white text-sm"
                    onClick={() =>
                      void run(
                        () =>
                          triageRequest(id, {
                            priority,
                            triageNotes,
                            isEmergency: detail.isEmergency
                          }),
                        "Triage saved"
                      )
                    }
                  >
                    Save triage
                  </button>
                </>
              ) : null}

              {detail.status === "UNDER_REVIEW" ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 w-full rounded-lg bg-emerald-600 text-sm text-white"
                    onClick={() => void run(() => approveRequest(id), "Accepted")}
                  >
                    Accept (approve)
                  </button>
                  <input
                    className="min-h-11 w-full rounded-lg border px-3 text-sm"
                    placeholder="Question for requester (needs information)"
                    value={infoQuestion}
                    onChange={(e) => setInfoQuestion(e.target.value)}
                    aria-label="Question for requester"
                  />
                  <button
                    type="button"
                    disabled={busy || infoQuestion.trim().length < 3}
                    className="min-h-11 w-full rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-950"
                    onClick={() =>
                      void run(
                        () => requestMoreInformation(id, { question: infoQuestion.trim() }),
                        "Asked for more information"
                      )
                    }
                  >
                    Ask for more information
                  </button>
                  <select
                    className="min-h-11 w-full rounded-lg border px-3 text-sm"
                    value={rejectType}
                    onChange={(e) => setRejectType(e.target.value)}
                    aria-label="Closure resolution type"
                  >
                    <option value="DUPLICATE">Duplicate</option>
                    <option value="NOT_MAINTENANCE">Not maintenance</option>
                    <option value="INVALID_REQUEST">Invalid request</option>
                    <option value="ALREADY_RESOLVED">Already resolved</option>
                    <option value="INSUFFICIENT_INFORMATION">Insufficient information</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    className="min-h-11 w-full rounded-lg border px-3 text-sm"
                    placeholder="Closure reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    aria-label="Closure reason"
                  />
                  <button
                    type="button"
                    disabled={busy || (rejectType === "OTHER" && rejectReason.trim().length < 3)}
                    className="min-h-11 w-full rounded-lg border border-red-200 text-sm text-red-700"
                    onClick={() =>
                      void run(
                        () =>
                          rejectRequest(id, {
                            reasonType: rejectType,
                            reason: rejectReason.trim() || undefined
                          }),
                        "Closed without work order"
                      )
                    }
                  >
                    Close without work order
                  </button>
                </>
              ) : null}

              {detail.status === "NEEDS_INFORMATION" ? (
                <>
                  <p className="text-sm text-slate-700" role="status">
                    Waiting for requester information. Resume review when ready.
                  </p>
                  <input
                    className="min-h-11 w-full rounded-lg border px-3 text-sm"
                    placeholder="Optional note when resuming"
                    value={resumeNote}
                    onChange={(e) => setResumeNote(e.target.value)}
                    aria-label="Resume review note"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 w-full rounded-lg bg-brand-600 text-sm text-white"
                    onClick={() =>
                      void run(
                        () => resumeRequestReview(id, { responseNote: resumeNote.trim() || undefined }),
                        "Review resumed"
                      )
                    }
                  >
                    Resume review
                  </button>
                </>
              ) : null}

              {detail.status === "APPROVED" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 w-full rounded-lg bg-slate-900 text-sm text-white"
                  onClick={() =>
                    void run(async () => {
                      const result = await convertRequestToWorkOrder(id);
                      if (result.workOrder?.id) {
                        toast.message(
                          result.alreadyConverted
                            ? `Already linked to ${result.workOrder.woNumber}`
                            : `Created ${result.workOrder.woNumber}`
                        );
                      }
                    }, "Converted")
                  }
                >
                  Convert to Work Order
                </button>
              ) : null}

              {dupes.length > 0 && detail.status === "UNDER_REVIEW" ? (
                <div className="space-y-2 border-t border-brand-100 pt-3">
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Possible duplicates (not auto-rejected)
                  </p>
                  {dupes.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`block w-full rounded-lg border px-2 py-2 text-left text-xs ${canonicalDupId === d.id ? "border-brand-500 bg-white" : "bg-white"}`}
                      onClick={() => setCanonicalDupId(d.id)}
                    >
                      {d.requestNumber} · {d.statusLabel} · {d.description.slice(0, 60)}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busy || !canonicalDupId}
                    className="min-h-11 w-full rounded-lg border text-sm disabled:opacity-40"
                    onClick={() =>
                      void run(
                        () =>
                          markRequestDuplicate(id, {
                            canonicalRequestId: canonicalDupId,
                            reason: "Marked duplicate of active request"
                          }),
                        "Marked duplicate"
                      )
                    }
                  >
                    Mark as duplicate of selected
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
