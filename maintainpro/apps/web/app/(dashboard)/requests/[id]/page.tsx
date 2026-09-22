"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  respondToInformationRequest,
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
  reportedUrgency?: string | null;
  safetyImpact?: string | null;
  productionImpact?: string | null;
  targetUnresolved?: boolean;
  approximateLocation?: string | null;
  jobDomain?: string | null;
  reportedAt?: string;
  failureNoticedAt?: string | null;
  triageNotes?: string | null;
  publicUpdateNote?: string | null;
  workOrderId?: string | null;
  workOrder?: { id: string; woNumber: string; status?: string } | null;
  asset?: { id: string; assetTag: string; name: string } | null;
  vehicle?: {
    id: string;
    registrationNo: string;
    code?: string | null;
    name: string;
  } | null;
  site?: { id: string; code: string; name: string } | null;
  functionalLocation?: { id: string; code: string; name: string } | null;
  domain?: { id: string; code: string; name: string } | null;
  problemCategory?: { name: string } | null;
  problemCategoryLabel?: string | null;
  reportedBy?: { id: string; name: string; email?: string } | null;
  reportedById?: string;
  rejectionReason?: string | null;
  resolutionCode?: string | null;
  originalSubmission?: Record<string, unknown> | null;
  contextSnapshot?: Record<string, unknown> | null;
  history?: Array<{
    id: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    toStatusLabel?: string | null;
    reason?: string | null;
    createdAt: string;
    isInternal?: boolean;
    actorName?: string | null;
    actor?: { name?: string } | null;
  }>;
};

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const user = useCurrentUser();
  const role = extractRoleName({ role: user.role });
  const canTriageRole = role != null && TRIAGE_ROLES.has(role);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectType, setRejectType] = useState("INVALID_REQUEST");
  const [infoQuestion, setInfoQuestion] = useState("");
  const [requesterResponse, setRequesterResponse] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [triageNotes, setTriageNotes] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [priorityReason, setPriorityReason] = useState("");
  const [dupes, setDupes] = useState<MaintenanceRequestListItem[]>([]);
  const [canonicalDupId, setCanonicalDupId] = useState("");

  const isOwner = useMemo(() => {
    if (!detail || !user.id) return false;
    return detail.reportedById === user.id || detail.reportedBy?.id === user.id;
  }, [detail, user.id]);

  const canGovern = canTriageRole && !isOwner;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await getMaintenanceRequest(id)) as Detail;
      setDetail(data);
      setPriority(String(data.priority || "MEDIUM"));
      setTriageNotes(String(data.triageNotes || ""));
      if (canTriageRole) {
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
  }, [id, canTriageRole]);

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
  const original = detail.originalSubmission || {};
  const publicHistory = (detail.history || []).filter((h) => canGovern || canTriageRole || !h.isInternal);
  const needsInfoQuestion =
    [...(detail.history || [])]
      .reverse()
      .find((h) => h.action === "NEEDS_INFORMATION")?.reason || detail.publicUpdateNote;

  const targetLabel = detail.vehicle
    ? `${detail.vehicle.registrationNo}${
        detail.vehicle.code ? ` — ${detail.vehicle.code}` : ""
      } — ${detail.vehicle.name}`
    : detail.asset
      ? `${detail.asset.assetTag} — ${detail.asset.name}`
      : detail.functionalLocation
        ? `${detail.functionalLocation.code} — ${detail.functionalLocation.name}`
        : detail.targetUnresolved
          ? `Not sure${detail.approximateLocation ? ` · ${detail.approximateLocation}` : ""}`
          : "—";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs />
      <ResponsivePageHeader
        title={detail.requestNumber}
        description={detail.statusLabel || detail.status}
        actions={
          detail.workOrder ? (
            <Link
              href={`/work-orders?wo=${detail.workOrder.id}` as Route}
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
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Original request
            </h2>
            <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide">
              <span className="rounded bg-brand-50 px-2 py-1 text-brand-800">
                {detail.statusLabel || detail.status}
              </span>
              {detail.reportedUrgency ? (
                <span className="rounded bg-slate-100 px-2 py-1">
                  Reported: {detail.reportedUrgency.replace("_", " ")}
                </span>
              ) : null}
              <span className="rounded bg-slate-100 px-2 py-1">Official: {detail.priority}</span>
              {detail.targetUnresolved ? (
                <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">Target unresolved</span>
              ) : null}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
              {String(original.description || detail.description)}
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Target</dt>
                <dd>{targetLabel}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Site</dt>
                <dd>{detail.site?.name || String(snapshot.siteName || "—")}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Safety impact</dt>
                <dd>{detail.safetyImpact || String(original.safetyImpact || "—")}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Production impact</dt>
                <dd>{detail.productionImpact || String(original.productionImpact || "—")}</dd>
              </div>
            </dl>
          </section>

          {detail.status === "NEEDS_INFORMATION" && isOwner ? (
            <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <h2 className="font-semibold text-amber-950">Question from reviewer</h2>
              <p className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-800">
                {needsInfoQuestion || "Please provide more information."}
              </p>
              <label className="block text-sm font-medium">
                Your response *
                <textarea
                  className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
                  value={requesterResponse}
                  onChange={(e) => setRequesterResponse(e.target.value)}
                  placeholder="Answer the reviewer’s question"
                />
              </label>
              <button
                type="button"
                disabled={busy || requesterResponse.trim().length < 3}
                className="min-h-11 w-full rounded-lg bg-brand-600 text-sm text-white disabled:opacity-40"
                onClick={() =>
                  void run(
                    () =>
                      respondToInformationRequest(id, {
                        response: requesterResponse.trim()
                      }),
                    "Response submitted"
                  )
                }
              >
                Submit response
              </button>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-semibold">Public updates</h2>
            {detail.publicUpdateNote ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.publicUpdateNote}</p>
            ) : (
              <p className="text-sm text-slate-500">No public updates yet.</p>
            )}
            {detail.rejectionReason || detail.resolutionCode ? (
              <p className="mt-3 text-sm text-slate-700">
                Resolution: {detail.resolutionCode || "Closed"}
                {detail.rejectionReason ? ` — ${detail.rejectionReason}` : ""}
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-semibold">Lifecycle timeline</h2>
            <ul className="space-y-2 text-sm">
              {publicHistory.map((h) => (
                <li key={h.id} className="border-l-2 border-slate-200 pl-3">
                  <div className="font-medium">{h.action}</div>
                  <div className="text-xs text-slate-500">
                    {h.fromStatus ? `${h.fromStatus} → ` : ""}
                    {h.toStatusLabel || h.toStatus || ""} ·{" "}
                    {new Date(h.createdAt).toLocaleString()}
                    {h.actorName || h.actor?.name
                      ? ` · ${h.actorName || h.actor?.name}`
                      : ""}
                  </div>
                  {h.reason && !h.isInternal ? (
                    <div className="text-slate-600">{h.reason}</div>
                  ) : null}
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
            {detail.jobDomain ? (
              <p className="mt-2 text-slate-600">Job domain: {detail.jobDomain}</p>
            ) : null}
            {detail.workOrder ? (
              <Link
                href={`/work-orders?wo=${detail.workOrder.id}` as Route}
                className="mt-3 inline-flex text-brand-700"
              >
                View work order {detail.workOrder.woNumber}
              </Link>
            ) : null}
          </section>

          {isOwner && detail.status === "NEW" ? (
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

          {canGovern ? (
            <section className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
              <h2 className="font-semibold text-brand-950">Triage / review</h2>

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
                    Official priority
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
                  {priority !== detail.priority ? (
                    <input
                      className="min-h-11 w-full rounded-lg border px-3 text-sm"
                      placeholder="Reason for priority change"
                      value={priorityReason}
                      onChange={(e) => setPriorityReason(e.target.value)}
                    />
                  ) : null}
                  <textarea
                    className="min-h-20 w-full rounded-lg border p-2 text-sm"
                    placeholder="Internal triage notes (not shown to requesters)"
                    value={triageNotes}
                    onChange={(e) => setTriageNotes(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={
                      busy ||
                      (priority !== detail.priority && priorityReason.trim().length < 3)
                    }
                    className="min-h-11 w-full rounded-lg border bg-white text-sm disabled:opacity-40"
                    onClick={() =>
                      void run(
                        () =>
                          triageRequest(id, {
                            priority,
                            triageNotes,
                            reason:
                              priority !== detail.priority
                                ? priorityReason.trim()
                                : undefined,
                            targetUnresolved: false,
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
                    disabled={busy || Boolean(detail.targetUnresolved)}
                    className="min-h-11 w-full rounded-lg bg-emerald-600 text-sm text-white disabled:opacity-40"
                    onClick={() => void run(() => approveRequest(id), "Accepted")}
                  >
                    Accept
                  </button>
                  {detail.targetUnresolved ? (
                    <p className="text-xs text-amber-800">
                      Confirm a machine, vehicle, or location in triage before accepting.
                    </p>
                  ) : null}
                  <input
                    className="min-h-11 w-full rounded-lg border px-3 text-sm"
                    placeholder="Question for requester"
                    value={infoQuestion}
                    onChange={(e) => setInfoQuestion(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || infoQuestion.trim().length < 3}
                    className="min-h-11 w-full rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-950"
                    onClick={() =>
                      void run(
                        () =>
                          requestMoreInformation(id, {
                            question: infoQuestion.trim()
                          }),
                        "Asked for more information"
                      )
                    }
                  >
                    Request information
                  </button>
                  <select
                    className="min-h-11 w-full rounded-lg border px-3 text-sm"
                    value={rejectType}
                    onChange={(e) => setRejectType(e.target.value)}
                  >
                    <option value="DUPLICATE">Duplicate</option>
                    <option value="NOT_MAINTENANCE">Not maintenance</option>
                    <option value="INVALID_REQUEST">Invalid request</option>
                    <option value="ALREADY_RESOLVED">Resolved without WO</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    className="min-h-11 w-full rounded-lg border px-3 text-sm"
                    placeholder="Closure reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
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
                    Waiting for the requester’s response. Do not type a reply on their behalf.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 w-full rounded-lg border bg-white text-sm"
                    onClick={() =>
                      void run(() => resumeRequestReview(id), "Review resumed (internal)")
                    }
                  >
                    Resume review (internal)
                  </button>
                </>
              ) : null}

              {detail.status === "APPROVED" ? (
                <button
                  type="button"
                  disabled={busy || Boolean(detail.targetUnresolved)}
                  className="min-h-11 w-full rounded-lg bg-slate-900 text-sm text-white disabled:opacity-40"
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

              {dupes.length > 0 ? (
                <div className="space-y-2 border-t border-brand-100 pt-3">
                  <h3 className="text-sm font-semibold">Possible existing issue</h3>
                  <ul className="space-y-1 text-xs">
                    {dupes.map((d) => (
                      <li key={d.id}>
                        <Link href={`/requests/${d.id}` as Route} className="text-brand-700">
                          {d.requestNumber}
                        </Link>{" "}
                        · {d.statusLabel}
                      </li>
                    ))}
                  </ul>
                  <input
                    className="min-h-11 w-full rounded-lg border px-3 text-sm"
                    placeholder="Canonical request id"
                    value={canonicalDupId}
                    onChange={(e) => setCanonicalDupId(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !canonicalDupId.trim()}
                    className="min-h-11 w-full rounded-lg border text-sm"
                    onClick={() =>
                      void run(
                        () =>
                          markRequestDuplicate(id, {
                            canonicalRequestId: canonicalDupId.trim(),
                            reason: rejectReason.trim() || "Confirmed duplicate"
                          }),
                        "Marked duplicate"
                      )
                    }
                  >
                    Close as duplicate
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {canTriageRole && isOwner ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Segregation of duties: you reported this request, so review/accept/convert actions are
              blocked for you.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
