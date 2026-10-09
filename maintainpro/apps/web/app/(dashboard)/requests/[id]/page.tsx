"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
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
  type MaintenanceRequestListItem,
  type RequestAllowedActions
} from "@/lib/maintenance-requests-api";
import {
  actionBlockedReason,
  isActionAllowed,
  requestHistoryActionLabel,
  requestNextStep,
  requestResolutionLabel,
  requestStatusLabel,
  requestValueLabel
} from "@/lib/maintenance-request-ui";

type TargetKind = "asset" | "vehicle" | "location";

type Detail = Record<string, unknown> & {
  id: string;
  requestNumber: string;
  status: string;
  priority: string;
  description: string;
  isEmergency?: boolean;
  reportedUrgency?: string | null;
  safetyImpact?: string | null;
  productionImpact?: string | null;
  targetUnresolved?: boolean;
  approximateLocation?: string | null;
  jobDomain?: string | null;
  reportedAt?: string;
  triageNotes?: string | null;
  publicUpdateNote?: string | null;
  workOrder?: { id: string; woNumber: string; status?: string } | null;
  asset?: { id: string; assetTag: string; name: string } | null;
  vehicle?: { id: string; registrationNo: string; code?: string | null; name: string } | null;
  site?: { id: string; code: string; name: string } | null;
  functionalLocation?: { id: string; code: string; name: string } | null;
  problemCategoryLabel?: string | null;
  reportedBy?: { id: string; name: string } | null;
  reportedById?: string;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  resolutionCode?: string | null;
  duplicateOf?: { id: string; requestNumber: string } | null;
  originalSubmission?: Record<string, unknown> | null;
  contextSnapshot?: Record<string, unknown> | null;
  allowedActions?: RequestAllowedActions;
  history?: Array<{
    id: string;
    action: string;
    toStatus?: string | null;
    reason?: string | null;
    createdAt: string;
    isInternal?: boolean;
    actorName?: string | null;
  }>;
};

const CLOSE_REASONS = [
  ["NOT_MAINTENANCE", "Not a maintenance issue"],
  ["ALREADY_RESOLVED", "Already resolved — no work needed"],
  ["INVALID_REQUEST", "Invalid or incomplete request"],
  ["DUPLICATE", "Duplicate (without linking)"],
  ["OTHER", "Other reason"]
] as const;

const NEXT_STEP_TONES = {
  info: "border-sky-200 bg-sky-50 text-sky-950",
  waiting: "border-slate-200 bg-slate-50 text-slate-900",
  blocked: "border-amber-300 bg-amber-50 text-amber-950",
  done: "border-emerald-200 bg-emerald-50 text-emerald-950"
} as const;

const inputClass = "min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm";

function BlockedNote({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return <p className="text-xs text-amber-800">{reason}</p>;
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const user = useCurrentUser();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closeType, setCloseType] = useState<string>("NOT_MAINTENANCE");
  const [closeReason, setCloseReason] = useState("");
  const [infoQuestion, setInfoQuestion] = useState("");
  const [requesterResponse, setRequesterResponse] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [triageNotes, setTriageNotes] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [priorityReason, setPriorityReason] = useState("");
  const [targetKind, setTargetKind] = useState<TargetKind>("asset");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [dupes, setDupes] = useState<MaintenanceRequestListItem[]>([]);
  const [canonicalDupId, setCanonicalDupId] = useState("");
  const [dupReason, setDupReason] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = (await getMaintenanceRequest(id)) as Detail;
      setDetail(data);
      setPriority(String(data.priority || "MEDIUM"));
      setPriorityReason("");
      setTriageNotes(String(data.triageNotes || ""));
      setTargetId(null);
      setTargetKind(data.vehicle ? "vehicle" : data.asset ? "asset" : data.functionalLocation ? "location" : "asset");
      if (isActionAllowed(data.allowedActions, "markDuplicate")) {
        try {
          const candidates = await fetchDuplicateCandidates(id);
          setDupes(candidates.items || []);
        } catch {
          setDupes([]);
        }
      } else {
        setDupes([]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load this request."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "That action could not be completed."));
    } finally {
      // Always reload: a failed action (e.g. someone else changed the request) must show current state.
      await load();
      setBusy(false);
    }
  };

  const isOwner = useMemo(
    () => Boolean(detail && user.id && (detail.reportedById === user.id || detail.reportedBy?.id === user.id)),
    [detail, user.id]
  );

  if (loading) {
    return (
      <div className="ops-page" aria-busy="true">
        <p className="sr-only">Loading request</p>
        <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-xl bg-slate-100 lg:col-span-2" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="ops-page">
        <PageBreadcrumbs />
        <ErrorState
          title="This request is unavailable"
          description={error || "The request could not be found."}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
        <Link href={"/requests" as Route} className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700">
          ← Back to requests
        </Link>
      </div>
    );
  }

  const actions = detail.allowedActions;
  const allowed = (key: Parameters<typeof isActionAllowed>[1]) => isActionAllowed(actions, key);
  const snapshot = detail.contextSnapshot || {};
  const original = detail.originalSubmission || {};
  const nextStep = requestNextStep({ ...detail, isOwner });
  const needsInfoQuestion =
    [...(detail.history || [])].reverse().find((h) => h.action === "NEEDS_INFORMATION")?.reason ||
    detail.publicUpdateNote;
  const priorityChanged = priority !== detail.priority;
  const reviewStarted = detail.status !== "NEW";
  const hasTarget = Boolean(detail.asset || detail.vehicle || detail.functionalLocation);

  const targetLabel = detail.vehicle
    ? `${detail.vehicle.registrationNo}${detail.vehicle.code ? ` — ${detail.vehicle.code}` : ""} — ${detail.vehicle.name}`
    : detail.asset
      ? `${detail.asset.assetTag} — ${detail.asset.name}`
      : detail.functionalLocation
        ? `${detail.functionalLocation.code} — ${detail.functionalLocation.name}`
        : detail.targetUnresolved
          ? `Not sure${detail.approximateLocation ? ` · ${detail.approximateLocation}` : ""}`
          : "—";

  const saveTriage = () => {
    const body: Record<string, unknown> = {
      priority,
      triageNotes,
      reason: priorityChanged ? priorityReason.trim() : undefined,
      isEmergency: detail.isEmergency
    };
    if (targetId) {
      // A newly confirmed target replaces the previous one; site is re-derived from an asset.
      body.assetId = targetKind === "asset" ? targetId : null;
      body.vehicleId = targetKind === "vehicle" ? targetId : null;
      body.functionalLocationId = targetKind === "location" ? targetId : null;
      if (targetKind === "asset") body.siteId = null;
      body.targetUnresolved = false;
    }
    void run(() => triageRequest(id, body), targetId ? "Triage saved and target confirmed" : "Triage saved");
  };

  const governancePanel =
    allowed("startReview") ||
    allowed("triage") ||
    allowed("requestInformation") ||
    allowed("resumeReview") ||
    allowed("approve") ||
    allowed("close") ||
    allowed("markDuplicate") ||
    allowed("convert");
  const selfGovernedReason = (
    ["approve", "triage", "startReview", "convert", "close"] as const
  )
    .map((key) => actionBlockedReason(actions, key))
    .find((reason) => reason && /segregation of duties/i.test(reason));

  return (
    <div className="ops-page">
      <PageBreadcrumbs />
      <ResponsivePageHeader
        eyebrow="Maintenance request"
        title={detail.requestNumber}
        description={detail.problemCategoryLabel || undefined}
        actions={
          detail.workOrder ? (
            <Link
              href={`/work-orders?wo=${detail.workOrder.id}` as Route}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium"
            >
              Open work order {detail.workOrder.woNumber}
            </Link>
          ) : null
        }
      />

      <section
        className={`rounded-xl border px-4 py-3 ${NEXT_STEP_TONES[nextStep.tone]}`}
        aria-label="Current status and next step"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-xs font-semibold">
            {requestStatusLabel(detail.status)}
          </span>
          <p className="font-semibold">{nextStep.title}</p>
        </div>
        {nextStep.detail ? <p className="mt-1 text-sm">{nextStep.detail}</p> : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Reported issue</h2>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded bg-slate-100 px-2 py-1">Priority: {requestValueLabel(detail.priority)}</span>
              {detail.reportedUrgency ? (
                <span className="rounded bg-slate-100 px-2 py-1">
                  Requester urgency: {requestValueLabel(detail.reportedUrgency)}
                </span>
              ) : null}
              {detail.isEmergency ? <span className="rounded bg-rose-100 px-2 py-1 text-rose-900">Emergency</span> : null}
              {detail.targetUnresolved ? (
                <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">Target not confirmed</span>
              ) : null}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
              {String(original.description || detail.description)}
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Machine / vehicle / location</dt>
                <dd>{targetLabel}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Site</dt>
                <dd>{detail.site?.name || String(snapshot.siteName || "—")}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Safety risk</dt>
                <dd>{requestValueLabel(detail.safetyImpact || (original.safetyImpact as string | undefined))}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Production impact</dt>
                <dd>{requestValueLabel(detail.productionImpact || (original.productionImpact as string | undefined))}</dd>
              </div>
              {detail.jobDomain ? (
                <div>
                  <dt className="text-slate-500">Work type</dt>
                  <dd>{requestValueLabel(detail.jobDomain)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {allowed("respond") ? (
            <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <h2 className="font-semibold text-amber-950">Question from the reviewer</h2>
              <p className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-800">
                {needsInfoQuestion || "Please provide more information."}
              </p>
              <label className="block text-sm font-medium">
                Your answer
                <textarea
                  className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
                  value={requesterResponse}
                  onChange={(e) => setRequesterResponse(e.target.value)}
                  placeholder="Answer the reviewer's question"
                />
              </label>
              <button
                type="button"
                disabled={busy || requesterResponse.trim().length < 3}
                className="min-h-11 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() =>
                  void run(async () => {
                    await respondToInformationRequest(id, { response: requesterResponse.trim() });
                    setRequesterResponse("");
                  }, "Answer sent")
                }
              >
                Send answer
              </button>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-semibold">Updates for the requester</h2>
            {detail.publicUpdateNote ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.publicUpdateNote}</p>
            ) : (
              <p className="text-sm text-slate-500">No updates yet.</p>
            )}
            {detail.status === "CLOSED" ? (
              <p className="mt-3 text-sm text-slate-700">
                Outcome: {requestResolutionLabel(detail.resolutionCode) || "Closed"}
                {detail.rejectionReason && detail.rejectionReason !== detail.resolutionCode ? ` — ${detail.rejectionReason}` : ""}
                {detail.duplicateOf ? (
                  <>
                    {" "}
                    (see{" "}
                    <Link href={`/requests/${detail.duplicateOf.id}` as Route} className="font-medium text-brand-700">
                      {detail.duplicateOf.requestNumber}
                    </Link>
                    )
                  </>
                ) : null}
              </p>
            ) : null}
            {detail.status === "CANCELLED" && detail.cancellationReason ? (
              <p className="mt-3 text-sm text-slate-700">Cancellation reason: {detail.cancellationReason}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-semibold">History</h2>
            {(detail.history || []).length === 0 ? (
              <p className="text-sm text-slate-500">No history recorded yet.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {(detail.history || []).map((h) => (
                  <li key={h.id} className="border-l-2 border-slate-200 pl-3">
                    <div className="font-medium text-slate-900">
                      {requestHistoryActionLabel(h.action)}
                      {h.isInternal ? (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                          Internal
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(h.createdAt).toLocaleString()}
                      {h.actorName ? ` · ${h.actorName}` : ""}
                      {h.toStatus ? ` · now ${requestStatusLabel(h.toStatus)}` : ""}
                    </div>
                    {h.reason ? <div className="mt-0.5 whitespace-pre-wrap text-slate-600">{h.reason}</div> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <h2 className="mb-2 font-semibold">Reported by</h2>
            <p>{detail.reportedBy?.name || "—"}</p>
            <p className="text-slate-500">{detail.reportedAt ? new Date(detail.reportedAt).toLocaleString() : "—"}</p>
            {detail.workOrder ? (
              <Link href={`/work-orders?wo=${detail.workOrder.id}` as Route} className="mt-3 inline-flex font-medium text-brand-700">
                Open work order {detail.workOrder.woNumber}
              </Link>
            ) : null}
          </section>

          {governancePanel ? (
            <section className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4" aria-label="Review actions">
              <h2 className="font-semibold text-brand-950">Review</h2>

              {allowed("startReview") ? (
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white disabled:opacity-40"
                  onClick={() => void run(() => startRequestReview(id), "Review started")}
                >
                  Start review
                </button>
              ) : null}

              {allowed("triage") ? (
                <div className="space-y-2">
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">
                      {detail.targetUnresolved || !hasTarget ? "Confirm the maintenance target" : "Change the maintenance target"}
                    </legend>
                    <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Target type">
                      {(
                        [
                          ["asset", "Machine"],
                          ["vehicle", "Vehicle"],
                          ["location", "Location"]
                        ] as const
                      ).map(([kind, label]) => (
                        <button
                          key={kind}
                          type="button"
                          role="radio"
                          aria-checked={targetKind === kind}
                          className={`min-h-11 rounded-lg border text-sm ${
                            targetKind === kind ? "border-brand-500 bg-white font-semibold" : "border-slate-200 bg-white/60"
                          }`}
                          onClick={() => {
                            setTargetKind(kind);
                            setTargetId(null);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {targetKind === "asset" ? (
                      <EntityPicker
                        key="asset"
                        endpoint="/assets"
                        searchParam="search"
                        pageSizeParam="limit"
                        value={targetId}
                        onChange={(value) => setTargetId(value)}
                        displayField="name"
                        secondaryField="assetTag"
                        placeholder="Search machines by name or tag"
                      />
                    ) : targetKind === "vehicle" ? (
                      <EntityPicker
                        key="vehicle"
                        endpoint="/vehicles"
                        value={targetId}
                        onChange={(value) => setTargetId(value)}
                        displayField="registrationNo"
                        secondaryField="vehicleModel"
                        placeholder="Search vehicles by registration"
                      />
                    ) : (
                      <EntityPicker
                        key="location"
                        endpoint="/organization/locations"
                        value={targetId}
                        onChange={(value) => setTargetId(value)}
                        displayField="name"
                        secondaryField="code"
                        placeholder="Search functional locations"
                      />
                    )}
                    {detail.approximateLocation ? (
                      <p className="text-xs text-slate-600">Requester described: {detail.approximateLocation}</p>
                    ) : null}
                  </fieldset>

                  <label className="block text-sm font-medium">
                    Priority
                    <select className={`mt-1 ${inputClass}`} value={priority} onChange={(e) => setPriority(e.target.value)}>
                      {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                        <option key={value} value={value}>
                          {requestValueLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {priorityChanged && reviewStarted ? (
                    <input
                      className={inputClass}
                      aria-label="Reason for priority change"
                      placeholder="Reason for priority change (required)"
                      value={priorityReason}
                      onChange={(e) => setPriorityReason(e.target.value)}
                    />
                  ) : null}
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-slate-300 p-2 text-sm"
                    aria-label="Internal triage notes"
                    placeholder="Internal notes (not shown to the requester)"
                    value={triageNotes}
                    onChange={(e) => setTriageNotes(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || (priorityChanged && reviewStarted && priorityReason.trim().length < 3)}
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white text-sm font-medium disabled:opacity-40"
                    onClick={saveTriage}
                  >
                    Save triage
                  </button>
                </div>
              ) : null}

              {allowed("approve") || actionBlockedReason(actions, "approve") ? (
                <div className="space-y-1 border-t border-brand-100 pt-3">
                  <button
                    type="button"
                    disabled={busy || !allowed("approve")}
                    className="min-h-11 w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white disabled:opacity-40"
                    onClick={() => void run(() => approveRequest(id), "Request accepted")}
                  >
                    Accept for work
                  </button>
                  <BlockedNote reason={actionBlockedReason(actions, "approve")} />
                </div>
              ) : null}

              {allowed("convert") || actionBlockedReason(actions, "convert") ? (
                <div className="space-y-1 border-t border-brand-100 pt-3">
                  <button
                    type="button"
                    disabled={busy || !allowed("convert")}
                    className="min-h-11 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white disabled:opacity-40"
                    onClick={() =>
                      void run(async () => {
                        const result = await convertRequestToWorkOrder(id);
                        if (result.workOrder?.woNumber) {
                          toast.message(
                            result.alreadyConverted
                              ? `Already linked to ${result.workOrder.woNumber}`
                              : `Created work order ${result.workOrder.woNumber}`
                          );
                        }
                      }, "Work order created")
                    }
                  >
                    Create work order
                  </button>
                  <BlockedNote reason={actionBlockedReason(actions, "convert")} />
                </div>
              ) : null}

              {allowed("requestInformation") ? (
                <div className="space-y-2 border-t border-brand-100 pt-3">
                  <label className="block text-sm font-medium">
                    Ask the requester
                    <input
                      className={`mt-1 ${inputClass}`}
                      placeholder="Question the requester will see"
                      value={infoQuestion}
                      onChange={(e) => setInfoQuestion(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || infoQuestion.trim().length < 3}
                    className="min-h-11 w-full rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-950 disabled:opacity-40"
                    onClick={() =>
                      void run(async () => {
                        await requestMoreInformation(id, { question: infoQuestion.trim() });
                        setInfoQuestion("");
                      }, "Question sent to the requester")
                    }
                  >
                    Send question
                  </button>
                </div>
              ) : null}

              {allowed("resumeReview") ? (
                <div className="space-y-2 border-t border-brand-100 pt-3">
                  <p className="text-sm text-slate-700" role="status">
                    Waiting for the requester&apos;s answer. Resume only if you already have the information.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white text-sm"
                    onClick={() => void run(() => resumeRequestReview(id), "Review resumed")}
                  >
                    Resume review without an answer
                  </button>
                </div>
              ) : null}

              {allowed("markDuplicate") && dupes.length > 0 ? (
                <fieldset className="space-y-2 border-t border-brand-100 pt-3">
                  <legend className="text-sm font-semibold">Possible duplicates</legend>
                  {dupes.map((d) => (
                    <label key={d.id} className="flex min-h-11 items-start gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm">
                      <input
                        type="radio"
                        name="canonical-request"
                        className="mt-1"
                        checked={canonicalDupId === d.id}
                        onChange={() => setCanonicalDupId(d.id)}
                      />
                      <span>
                        <Link href={`/requests/${d.id}` as Route} className="font-medium text-brand-700" target="_blank">
                          {d.requestNumber}
                        </Link>{" "}
                        · {requestStatusLabel(d.status)}
                        <span className="block line-clamp-1 text-xs text-slate-500">{d.description}</span>
                      </span>
                    </label>
                  ))}
                  <input
                    className={inputClass}
                    aria-label="Duplicate note"
                    placeholder="Note for the requester (optional)"
                    value={dupReason}
                    onChange={(e) => setDupReason(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !canonicalDupId}
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white text-sm disabled:opacity-40"
                    onClick={() =>
                      void run(
                        () =>
                          markRequestDuplicate(id, {
                            canonicalRequestId: canonicalDupId,
                            reason: dupReason.trim() || "Same issue already reported"
                          }),
                        "Closed as duplicate"
                      )
                    }
                  >
                    Close as duplicate of selected request
                  </button>
                </fieldset>
              ) : null}

              {allowed("close") ? (
                <details className="border-t border-brand-100 pt-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-red-800">
                    Close without a work order
                  </summary>
                  <div className="mt-2 space-y-2">
                    <select
                      className={inputClass}
                      aria-label="Closure reason type"
                      value={closeType}
                      onChange={(e) => setCloseType(e.target.value)}
                    >
                      {CLOSE_REASONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputClass}
                      aria-label="Closure explanation"
                      placeholder={closeType === "OTHER" ? "Explain why (required)" : "Explanation for the requester (optional)"}
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || (closeType === "OTHER" && closeReason.trim().length < 3)}
                      className="min-h-11 w-full rounded-lg border border-red-200 bg-white text-sm text-red-700 disabled:opacity-40"
                      onClick={() =>
                        void run(
                          () => rejectRequest(id, { reasonType: closeType, reason: closeReason.trim() || undefined }),
                          "Request closed without a work order"
                        )
                      }
                    >
                      Close request
                    </button>
                  </div>
                </details>
              ) : null}
            </section>
          ) : null}

          {selfGovernedReason ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{selfGovernedReason}</p>
          ) : null}

          {allowed("cancel") ? (
            <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">{isOwner ? "Cancel my request" : "Cancel request"}</h2>
              <input
                className={inputClass}
                aria-label="Cancellation reason"
                placeholder="Reason for cancelling"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || cancelReason.trim().length < 3}
                className="min-h-11 w-full rounded-lg border border-red-200 text-sm text-red-700 disabled:opacity-40"
                onClick={() =>
                  void run(async () => {
                    await cancelRequest(id, cancelReason.trim());
                    setCancelReason("");
                  }, "Request cancelled")
                }
              >
                Cancel request
              </button>
              <p className="text-xs text-slate-500">Cancelled requests cannot be reopened.</p>
            </section>
          ) : actionBlockedReason(actions, "cancel") ? (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              {actionBlockedReason(actions, "cancel")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
