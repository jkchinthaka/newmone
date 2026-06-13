import type { ReactNode } from "react";
import {
  Camera,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Package,
  PlayCircle,
  UserCheck,
  type LucideIcon
} from "lucide-react";

import { formatDateTime } from "@/lib/localization";

export const EVIDENCE_TIMELINE_EVENT_TYPES = [
  "reported",
  "assigned",
  "started",
  "photo_added",
  "part_requested",
  "completed",
  "approved"
] as const;

export type EvidenceTimelineEventType = (typeof EVIDENCE_TIMELINE_EVENT_TYPES)[number];

export type EvidenceTimelineEvent = {
  id: string;
  type: EvidenceTimelineEventType;
  label?: string;
  description?: string;
  occurredAt: string | Date;
  actorName?: string;
  meta?: ReactNode;
};

const EVENT_META: Record<
  EvidenceTimelineEventType,
  { icon: LucideIcon; defaultLabel: string; iconClassName: string }
> = {
  reported: { icon: CircleDot, defaultLabel: "Reported", iconClassName: "text-sky-600" },
  assigned: { icon: UserCheck, defaultLabel: "Assigned", iconClassName: "text-indigo-600" },
  started: { icon: PlayCircle, defaultLabel: "Started", iconClassName: "text-amber-600" },
  photo_added: { icon: Camera, defaultLabel: "Photo added", iconClassName: "text-violet-600" },
  completed: { icon: CheckCircle2, defaultLabel: "Completed", iconClassName: "text-emerald-600" },
  approved: { icon: ClipboardCheck, defaultLabel: "Approved", iconClassName: "text-brand-700" },
  part_requested: { icon: Package, defaultLabel: "Part requested", iconClassName: "text-orange-600" }
};

type EvidenceTimelineProps = {
  events: EvidenceTimelineEvent[];
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function EvidenceTimeline({
  events,
  title = "Evidence timeline",
  description = "Read-only chronological record of operational events.",
  emptyTitle = "No timeline events yet",
  emptyDescription = "Events will appear here when underlying records include dated activity fields."
}: EvidenceTimelineProps) {
  if (events.length === 0) {
    return (
      <section aria-labelledby="evidence-timeline-heading" className="rounded-xl border border-slate-200 bg-white p-5">
        <header>
          <h3 id="evidence-timeline-heading" className="text-sm font-semibold text-slate-900">
            {title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </header>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">{emptyTitle}</p>
      </section>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );

  return (
    <section aria-labelledby="evidence-timeline-heading" className="rounded-xl border border-slate-200 bg-white p-5">
      <header>
        <h3 id="evidence-timeline-heading" className="text-sm font-semibold text-slate-900">
          {title}
        </h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </header>

      <ol className="mt-4 space-y-0" aria-label={title}>
        {sorted.map((event, index) => {
          const meta = EVENT_META[event.type];
          const Icon = meta.icon;
          const isLast = index === sorted.length - 1;

          return (
            <li key={event.id} className="relative flex gap-3 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  className="absolute left-[11px] top-7 h-[calc(100%-0.75rem)] w-px bg-slate-200"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200 ${meta.iconClassName}`}
              >
                <Icon size={14} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-semibold text-slate-900">{event.label ?? meta.defaultLabel}</p>
                  <time className="text-xs text-slate-500" dateTime={new Date(event.occurredAt).toISOString()}>
                    {formatDateTime(event.occurredAt)}
                  </time>
                </div>
                {event.actorName ? (
                  <p className="mt-0.5 text-xs text-slate-500">By {event.actorName}</p>
                ) : null}
                {event.description ? <p className="mt-1 text-sm text-slate-600">{event.description}</p> : null}
                {event.meta ? <div className="mt-2">{event.meta}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function mapWorkOrderDatesToEvidenceTimeline(input: {
  id: string;
  createdAt?: string | null;
  startDate?: string | null;
  completedDate?: string | null;
  technicianName?: string | null;
}): EvidenceTimelineEvent[] {
  const events: EvidenceTimelineEvent[] = [];

  if (input.createdAt) {
    events.push({
      id: `${input.id}-reported`,
      type: "reported",
      occurredAt: input.createdAt,
      description: "Work order created."
    });
  }

  if (input.startDate) {
    events.push({
      id: `${input.id}-started`,
      type: "started",
      occurredAt: input.startDate,
      actorName: input.technicianName ?? undefined,
      description: "Work started."
    });
  }

  if (input.completedDate) {
    events.push({
      id: `${input.id}-completed`,
      type: "completed",
      occurredAt: input.completedDate,
      actorName: input.technicianName ?? undefined,
      description: "Work marked completed."
    });
  }

  return events;
}
