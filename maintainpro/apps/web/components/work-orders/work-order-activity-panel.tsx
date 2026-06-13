import Link from "next/link";
import type { Route } from "next";
import { AlertCircle, ExternalLink, Loader2 } from "lucide-react";

import { EvidenceTimeline } from "@/components/ui/evidence-timeline";
import {
  buildFacilityIssueDetailHref,
  formatLinkedFacilityIssueLocation,
  mapWorkOrderActivityToEvidenceTimeline,
  type WorkOrderActivityTimelineResponse,
  workOrderActivityUnavailableMessage
} from "@/lib/work-order-activity";
import type { EvidenceStorageReadiness, WorkOrderEvidenceItem } from "@/lib/work-order-evidence";
import { WorkOrderEvidencePanel } from "./work-order-evidence-panel";

type WorkOrderActivityPanelProps = {
  loading: boolean;
  error: string | null;
  timeline: WorkOrderActivityTimelineResponse | null;
  workOrderId?: string;
  evidenceReadiness?: EvidenceStorageReadiness | null;
  evidenceItems?: WorkOrderEvidenceItem[];
  evidenceLoading?: boolean;
  onEvidenceRefresh?: () => Promise<void> | void;
};

export function WorkOrderActivityPanel({
  loading,
  error,
  timeline,
  workOrderId,
  evidenceReadiness = null,
  evidenceItems = [],
  evidenceLoading = false,
  onEvidenceRefresh
}: WorkOrderActivityPanelProps) {
  if (loading) {
    return (
      <section
        aria-labelledby="work-order-activity-heading"
        className="rounded-xl border border-slate-200 bg-slate-50 p-5"
      >
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading activity timeline…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-labelledby="work-order-activity-heading"
        className="rounded-xl border border-amber-200 bg-amber-50 p-5"
        role="status"
      >
        <div className="flex items-start gap-2 text-sm text-amber-900">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{error || workOrderActivityUnavailableMessage()}</p>
        </div>
      </section>
    );
  }

  const linkedIssue = timeline?.linkedFacilityIssue ?? null;
  const issueHref = buildFacilityIssueDetailHref(linkedIssue?.id);
  const locationLabel = formatLinkedFacilityIssueLocation(linkedIssue);
  const events = mapWorkOrderActivityToEvidenceTimeline(timeline?.entries ?? []);

  return (
    <div className="space-y-4">
      {linkedIssue ? (
        <section
          aria-labelledby="linked-facility-issue-heading"
          className="rounded-xl border border-sky-200 bg-sky-50 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 id="linked-facility-issue-heading" className="text-sm font-semibold text-sky-950">
                Linked facility issue
              </h4>
              <p className="mt-1 text-sm font-medium text-sky-900">{linkedIssue.title}</p>
              {locationLabel ? <p className="mt-1 text-xs text-sky-800">{locationLabel}</p> : null}
              <p className="mt-2 text-sm text-sky-900">{linkedIssue.descriptionPreview}</p>
              <p className="mt-2 text-xs text-sky-800">
                {linkedIssue.category?.replaceAll("_", " ") ?? "Uncategorized"} · {linkedIssue.severity} ·{" "}
                {linkedIssue.status.replaceAll("_", " ")}
              </p>
            </div>
            {issueHref ? (
              <Link
                href={issueHref as Route}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-medium text-sky-900 hover:bg-sky-100"
              >
                View issue
                <ExternalLink size={12} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <EvidenceTimeline
        events={events}
        title="Activity & evidence"
        description="Chronological history derived from work order dates, linked facility issue context, and part requests."
        emptyTitle="No additional activity yet"
        emptyDescription="Timeline events appear when work order or linked issue records include dated fields."
      />

      {workOrderId ? (
        <WorkOrderEvidencePanel
          workOrderId={workOrderId}
          readiness={evidenceReadiness}
          items={evidenceItems}
          loading={evidenceLoading}
          onRefresh={onEvidenceRefresh}
        />
      ) : null}
    </div>
  );
}
