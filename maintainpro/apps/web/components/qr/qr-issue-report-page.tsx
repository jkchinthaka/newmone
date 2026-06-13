"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { FacilityIssueRoomSelector } from "@/components/cleaning/facility-issue-room-selector";
import { FacilityIssueDuplicateWarning } from "@/components/cleaning/facility-issue-duplicate-warning";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  buildDuplicateFacilityIssueCheckPayload,
  duplicateIssueCheckUnavailableMessage,
  type DuplicateFacilityIssueCandidate
} from "@/lib/facility-issue-duplicates";
import {
  buildCreateFacilityIssuePayload,
  canReportFacilityIssue,
  FACILITY_ISSUE_CATEGORY_OPTIONS,
  roomSelectionToRoomId,
  type FacilityIssueRoomSelection
} from "@/lib/facility-issue-ui";
import {
  parseQrIssueReportQueryParam,
  QR_ISSUE_REPORT_ROUTE
} from "@/lib/qr-issue-reporting";
import { resolveQrIssueReportContext } from "@/lib/qr-issue-report-resolver";
import { useCurrentUser } from "@/lib/use-current-user";

export function QrIssueReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const [submitting, setSubmitting] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [roomSelection, setRoomSelection] = useState<Partial<FacilityIssueRoomSelection>>({});
  const [requiresRoomSelection, setRequiresRoomSelection] = useState(false);
  const [contextSummary, setContextSummary] = useState<string | null>(null);
  const [hierarchyLabel, setHierarchyLabel] = useState<string | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateFacilityIssueCandidate[]>([]);
  const [duplicateCheckUnavailable, setDuplicateCheckUnavailable] = useState<string | null>(null);
  const [pendingCreatePayload, setPendingCreatePayload] = useState<Record<string, unknown> | null>(null);

  const canReport = canReportFacilityIssue({
    role: user.role,
    permissions: user.permissions
  });

  const parseResult = useMemo(
    () => parseQrIssueReportQueryParam(searchParams.get("qr")),
    [searchParams]
  );

  useEffect(() => {
    if (!canReport) {
      setLoadingContext(false);
      return;
    }

    if (!parseResult.ok) {
      setContextError(parseResult.error);
      setLoadingContext(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoadingContext(true);
      setContextError(null);

      const resolved = await resolveQrIssueReportContext(parseResult.payload);
      if (cancelled) {
        return;
      }

      if (!resolved.ok) {
        setContextError(resolved.error);
        setLoadingContext(false);
        return;
      }

      setRoomSelection(resolved.context.roomSelection);
      setRequiresRoomSelection(resolved.context.requiresRoomSelection);
      setContextSummary(resolved.context.contextSummary);
      setHierarchyLabel(resolved.context.hierarchyLabel);
      setLoadingContext(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [canReport, parseResult]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const roomId = roomSelectionToRoomId(roomSelection);

    if (requiresRoomSelection && !roomId) {
      toast.error("Select a room before submitting.");
      return;
    }

    const payload = buildCreateFacilityIssuePayload({
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      severity: String(formData.get("severity") ?? "MEDIUM"),
      roomId,
      category: String(formData.get("category") ?? ""),
      locationId: String(formData.get("locationId") ?? "") || undefined,
      slaHours: Number(formData.get("slaHours") ?? 24)
    });

    setSubmitting(true);

    try {
      try {
        const checkPayload = buildDuplicateFacilityIssueCheckPayload({
          title: String(payload.title ?? ""),
          description: String(payload.description ?? ""),
          severity: String(payload.severity ?? "MEDIUM"),
          roomId: typeof payload.roomId === "string" ? payload.roomId : undefined,
          locationId: typeof payload.locationId === "string" ? payload.locationId : undefined,
          category: typeof payload.category === "string" ? payload.category : undefined
        });
        const response = await apiClient.post("/cleaning/issues/duplicate-check", checkPayload);
        const candidates = (response.data?.data?.candidates ?? []) as DuplicateFacilityIssueCandidate[];

        if (candidates.length > 0) {
          setDuplicateCandidates(candidates);
          setPendingCreatePayload(payload);
          setDuplicateCheckUnavailable(null);
          return;
        }

        setDuplicateCandidates([]);
        setPendingCreatePayload(null);
      } catch {
        setDuplicateCheckUnavailable(duplicateIssueCheckUnavailableMessage());
        setDuplicateCandidates([]);
        setPendingCreatePayload(null);
      }

      await apiClient.post("/cleaning/issues", payload);
      toast.success("Issue reported");
      router.push("/cleaning/issues");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to submit issue"));
    } finally {
      setSubmitting(false);
    }
  };

  const continueDespiteDuplicates = async () => {
    if (!pendingCreatePayload) {
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.post("/cleaning/issues", pendingCreatePayload);
      toast.success("Issue reported");
      router.push("/cleaning/issues");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to submit issue"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canReport) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <PermissionState description="Your role cannot report facility issues from QR links." />
      </div>
    );
  }

  if (!parseResult.ok) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <ErrorState
          title="Invalid QR issue link"
          description={parseResult.error}
          retryLabel="Open issue list"
          onRetry={() => router.push("/cleaning/issues")}
        />
      </div>
    );
  }

  if (loadingContext) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <InlineLoadingState label="Resolving facility context…" />
      </div>
    );
  }

  if (contextError) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <ErrorState
          title="Facility context unavailable"
          description={contextError}
          retryLabel="Open facilities"
          onRetry={() => router.push("/facilities")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageBreadcrumbs />

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Report facility issue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Authenticated QR reporting. Context is resolved from your tenant — QR payloads never carry tenant secrets.
        </p>
        {contextSummary ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{contextSummary}</p>
        ) : null}
        {hierarchyLabel ? <p className="mt-2 text-xs text-slate-500">{hierarchyLabel}</p> : null}
      </header>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Title</span>
            <input
              required
              name="title"
              placeholder="Short title"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Severity</span>
            <select
              name="severity"
              defaultValue="MEDIUM"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Category (optional)</span>
            <select
              name="category"
              defaultValue=""
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">No category</option>
              {FACILITY_ISSUE_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <FacilityIssueRoomSelector
          idPrefix="qr-report-room"
          value={roomSelection}
          onChange={setRoomSelection}
          disabled={submitting || !requiresRoomSelection && Boolean(roomSelection.roomId)}
        />

        {requiresRoomSelection ? (
          <p className="text-xs text-amber-700">Select a room in this facility context before submitting.</p>
        ) : null}

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Description</span>
          <textarea
            required
            name="description"
            rows={4}
            placeholder="Describe the issue…"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">SLA hours</span>
          <input
            type="number"
            name="slaHours"
            min={1}
            max={720}
            defaultValue={24}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
          />
        </label>

        {duplicateCandidates.length > 0 ? (
          <FacilityIssueDuplicateWarning
            candidates={duplicateCandidates}
            unavailableMessage={duplicateCheckUnavailable}
            checking={submitting}
            onContinue={() => void continueDespiteDuplicates()}
            onDismiss={() => {
              setDuplicateCandidates([]);
              setPendingCreatePayload(null);
            }}
            continueLabel="Submit anyway"
          />
        ) : null}

        {duplicateCheckUnavailable && duplicateCandidates.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {duplicateCheckUnavailable}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit issue"}
          </button>
          <Link
            href="/cleaning/issues"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>

      <p className="text-xs text-slate-500">
        Route: {QR_ISSUE_REPORT_ROUTE}. Public anonymous reporting is not enabled.
      </p>
    </div>
  );
}
