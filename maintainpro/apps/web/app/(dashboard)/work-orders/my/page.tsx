"use client";

import { StartJobDialog } from "@/components/work-orders/start-job-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { RefreshCw, Search } from "lucide-react";

import { OperationalPageHeader } from "@/components/operational/operational-page-header";
import { QueueTabBar } from "@/components/operational/queue-tab-bar";
import { EmptyState, ErrorState, SkeletonCard, StatusBadge } from "@/components/ui/dashboard";
import { resolveMyJobFilter, myJobPurpose } from "@/lib/my-job-filters";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useLiveRefresh } from "@/lib/live-data";
import { mutationErrorMessage } from "@/lib/mutation-feedback";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { colomboTodayYmd, formatCalendarDate } from "@/lib/colombo-datetime";
import {
  MY_JOB_HOLD_CHOICES,
  buildHoldPayload,
  sentBackLabel,
  validateHoldNote,
  type MyJobHoldCode
} from "@/lib/my-job-hold";

type NextAction = { kind: "start" | "continue" | "summary" | "open" | "blocked"; label: string; reason?: string };

type MyJob = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  approvalStatus?: string | null;
  /** Sent as expectedVersion on every status action. */
  version: number;
  asset?: { name?: string | null; assetTag?: string | null } | null;
  functionalLocation?: { name?: string | null; code?: string | null } | null;
  site?: { name?: string | null } | null;
  /** Supervisor's send-back reason (REWORK_REQUIRED jobs only). */
  verificationRejectionReason?: string | null;
  nextAction: NextAction;
};

type Counts = {
  active: number;
  overdue: number;
  dueToday: number;
  waitingParts: number;
  evidenceNeeded: number;
  reworkRequired: number;
  inProgress: number;
  completed: number;
};

type ViewDef = readonly [string, string, keyof Counts];

/** Always shown: what to do, what is due, what is late, what is done. */
const MAIN_VIEWS: readonly ViewDef[] = [
  ["active", "To do", "active"],
  ["due-today", "Today", "dueToday"],
  ["overdue", "Late", "overdue"],
  ["completed", "Done", "completed"]
];
/** Shown up front only when something is waiting there; otherwise under More. */
const ATTENTION_VIEWS: readonly ViewDef[] = [
  ["rework-required", "Fix again", "reworkRequired"],
  ["evidence-needed", "Photos needed", "evidenceNeeded"]
];
const OTHER_VIEWS: readonly ViewDef[] = [
  ["in-progress", "In progress", "inProgress"],
  ["waiting-parts", "Waiting parts", "waitingParts"]
];

const PRIORITY_EDGE: Record<string, string> = {
  CRITICAL: "border-l-red-600",
  HIGH: "border-l-orange-500",
  MEDIUM: "border-l-amber-400",
  LOW: "border-l-slate-300"
};

/** Due-day wording uses Asia/Colombo calendar days, not the phone's time zone. */
function relativeDue(value?: string | null) {
  if (!value) return "No due date";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "No due date";
  const dueYmd = colomboTodayYmd(due);
  const todayYmd = colomboTodayYmd();
  const days = Math.round((Date.parse(`${dueYmd}T00:00:00Z`) - Date.parse(`${todayYmd}T00:00:00Z`)) / 86_400_000);
  const date = formatCalendarDate(dueYmd);
  if (days === 0) return `Due today · ${date}`;
  if (days === 1) return `Due tomorrow · ${date}`;
  if (days === -1) return `Due yesterday · ${date}`;
  if (days < 0) return `${Math.abs(days)} days overdue · ${date}`;
  return `Due ${date}`;
}

function locationLabel(job: MyJob) {
  const asset = job.asset?.name ? `${job.asset.name}${job.asset.assetTag ? ` (${job.asset.assetTag})` : ""}` : null;
  const place = job.functionalLocation?.name || job.site?.name;
  return [asset, place].filter(Boolean).join(" · ") || "No asset or location";
}

export default function MyJobsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [holdTarget, setHoldTarget] = useState<MyJob | null>(null);
  const view = resolveMyJobFilter({ filter: params.get("filter"), view: params.get("view") });
  const search = params.get("search") || "";
  const status = params.get("status") || "";
  const priority = params.get("priority") || "";
  const due = params.get("due") || "";
  const page = Math.max(1, Number(params.get("page") || "1"));
  const [searchInput, setSearchInput] = useState(search);
  const [items, setItems] = useState<MyJob[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [offline, setOffline] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startTarget, setStartTarget] = useState<MyJob | null>(null);
  const [blocker, setBlocker] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [moreViewsOpen, setMoreViewsOpen] = useState(false);

  const writeQuery = (next: Record<string, string | null>, resetPage = true) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || (key === "filter" && value === "active") || (key === "view" && value === "active")) query.delete(key);
      else query.set(key, value);
    }
    if (resetPage) query.delete("page");
    const text = query.toString();
    router.replace((text ? `${pathname}?${text}` : pathname) as Route);
  };

  const refresh = useCallback(async (options: { silent?: boolean } = {}) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (options.silent) return;
      setOffline(true);
      setLoading(false);
      setError("You are offline. Assigned jobs cannot be refreshed until the connection returns.");
      return;
    }
    if (!options.silent) {
      setLoading(true);
      setError(null);
      setForbidden(false);
    }
    setOffline(false);
    try {
      const response = await apiClient.get("/work-orders/my-jobs", {
        params: {
          filter: view,
          search: search || undefined,
          status: status || undefined,
          priority: priority || undefined,
          due: due || undefined,
          page,
          pageSize: 25
        }
      });
      const payload = response.data as {
        data?: { items?: MyJob[]; counts?: Counts; capped?: boolean };
        meta?: { total?: number };
      };
      setItems(payload.data?.items ?? []);
      setCounts(payload.data?.counts ?? null);
      setTotal(payload.meta?.total ?? payload.data?.items?.length ?? 0);
      setCapped(Boolean(payload.data?.capped));
      if (options.silent) setError(null);
    } catch (err) {
      // A failed background refresh keeps the jobs already on screen.
      if (options.silent) return;
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode === 401 || statusCode === 403) {
        setForbidden(true);
        setItems([]);
        setCounts(null);
      }
      setCapped(false);
      setError(getApiErrorMessage(err, "We couldn't load your jobs."));
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [due, page, priority, search, status, view]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLiveRefresh(() => refresh({ silent: true }));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if ((searchInput || "") === (search || "")) return;
      writeQuery({ search: searchInput || null });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    const onChange = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    };
  }, []);


  const filtersActive = Boolean(search || status || priority || due || (view && view !== "active"));
  // Start opens the camera first: the job only starts after a live before photo (see StartJobDialog).
  function startJob(job: MyJob) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
      setBlocker("You are offline. Start was not sent.");
      return;
    }
    setBlocker(null);
    setStartTarget(job);
  }

  function holdJob(job: MyJob) {
    setHoldTarget(job);
  }

  /** Returns an error message to keep the dialog open, or null when the hold was saved. */
  async function sendHold(job: MyJob, code: MyJobHoldCode, note: string): Promise<string | null> {
    setStartingId(job.id);
    try {
      await apiClient.post(`/work-orders/${job.id}/hold`, buildHoldPayload(code, note, job.version));
      toast.success(`${job.woNumber} placed on hold.`);
      setHoldTarget(null);
      await refresh();
      return null;
    } catch (err) {
      const message = mutationErrorMessage(err, "This job could not be placed on hold.");
      toast.error(message);
      return message;
    } finally {
      setStartingId(null);
    }
  }

  async function resumeJob(job: MyJob) {
    setStartingId(job.id);
    try {
      await apiClient.post(`/work-orders/${job.id}/resume`, { expectedVersion: job.version });
      toast.success(`${job.woNumber} resumed.`);
      await refresh();
    } catch (err) {
      toast.error(mutationErrorMessage(err, "This job could not be resumed."));
    } finally {
      setStartingId(null);
    }
  }

  /**
   * Completion needs more than a note: before/after photos, QR check, and an odometer reading on
   * vehicle jobs. Open the job so the full completion form (with those checks) is used.
   */
  function completeJob(job: MyJob) {
    router.push(`/work-orders?wo=${encodeURIComponent(job.id)}&action=complete` as Route);
  }

  return (
    <div className="ops-page pb-24 md:pb-0">
      <OperationalPageHeader
        title="My jobs"
        description="Your jobs, most urgent first. Tap the green button to do the next step."
        actions={
          <button type="button" aria-label="Refresh" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300" onClick={() => void refresh()}>
            <RefreshCw size={16} aria-hidden />
          </button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <QueueTabBar
          label="My jobs"
          selectedKey={view}
          moreOpen={moreViewsOpen}
          onMoreOpenChange={setMoreViewsOpen}
          onSelect={(key) => writeQuery({ filter: key, view: null })}
          primary={[
            ...MAIN_VIEWS,
            ...ATTENTION_VIEWS.filter(([key, , countKey]) => (counts?.[countKey] ?? 0) > 0 || view === key)
          ].map(([key, label, countKey]) => ({ key, label, count: counts ? counts[countKey] : undefined }))}
          more={[
            ...ATTENTION_VIEWS.filter(([key, , countKey]) => !((counts?.[countKey] ?? 0) > 0 || view === key)),
            ...OTHER_VIEWS
          ].map(([key, label, countKey]) => ({ key, label, count: counts ? counts[countKey] : undefined }))}
        />
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          writeQuery({ search: searchInput || null });
        }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search my jobs</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search job number, machine or place"
          />
        </label>
        {filtersActive ? (
          <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => { setSearchInput(""); writeQuery({ filter: null, view: null, search: null, status: null, priority: null, due: null }); }}>
            Clear
          </button>
        ) : null}
        <span className="w-full text-xs text-slate-500">{loading ? "Loading…" : `${total} job${total === 1 ? "" : "s"} · ${myJobPurpose(view)}`}</span>
      </form>

      {capped ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">Showing the first 500 assigned jobs. Narrow the list with search if you cannot find a job.</p> : null}
      {blocker ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">{blocker}</p> : null}
      {startTarget ? (
        <StartJobDialog
          job={startTarget}
          onClose={() => setStartTarget(null)}
          onStarted={async () => {
            setStartTarget(null);
            await refresh();
          }}
        />
      ) : null}
      {holdTarget ? (
        <HoldJobDialog
          job={holdTarget}
          submitting={startingId === holdTarget.id}
          onCancel={() => setHoldTarget(null)}
          onSubmit={(code, note) => sendHold(holdTarget, code, note)}
        />
      ) : null}
      {forbidden ? <ErrorState message="You cannot view assigned jobs. Your role does not include this workspace." onRetry={() => void refresh()} /> : null}
      {!forbidden && error ? <ErrorState message={`We couldn't load your jobs. ${error}`} onRetry={() => void refresh()} /> : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading jobs">
          {[0, 1, 2].map((row) => (
            <SkeletonCard key={row} />
          ))}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 && !filtersActive ? (
        <EmptyState
          title="No jobs assigned to you"
          description="When a job is assigned to your user, it will appear here."
          action={<button type="button" className="min-h-11 rounded border border-slate-300 px-3 text-sm" onClick={() => void refresh()}>Refresh</button>}
        />
      ) : null}
      {!loading && !error && items.length === 0 && filtersActive ? (
        <EmptyState
          title="No jobs match your filters"
          description="Clear the view or search to see assigned jobs."
          action={<button type="button" className="min-h-11 rounded border border-slate-300 px-3 text-sm" onClick={() => { setSearchInput(""); writeQuery({ filter: null, view: null, search: null, status: null, priority: null, due: null }); }}>Clear filters</button>}
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((job) => (
            <li key={job.id} className={`rounded-card border border-l-4 border-slate-200 bg-white p-4 shadow-card ${PRIORITY_EDGE[job.priority] ?? "border-l-slate-300"}`}>
              <JobBody
                job={job}
                starting={startingId === job.id}
                onStart={() => startJob(job)}
                onHold={() => holdJob(job)}
                onResume={() => void resumeJob(job)}
                onComplete={() => void completeJob(job)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {total > 25 ? (
        <div className="flex items-center gap-2 text-sm">
          <button type="button" className="min-h-11 rounded border px-3 disabled:opacity-50" disabled={page <= 1} onClick={() => writeQuery({ page: String(page - 1) }, false)}>Previous</button>
          <span>Page {page}</span>
          <button type="button" className="min-h-11 rounded border px-3 disabled:opacity-50" disabled={page * 25 >= total} onClick={() => writeQuery({ page: String(page + 1) }, false)}>Next</button>
        </div>
      ) : null}
    </div>
  );
}

function JobBody({
  job,
  starting,
  onStart,
  onHold,
  onResume,
  onComplete
}: {
  job: MyJob;
  starting: boolean;
  onStart: () => void;
  onHold: () => void;
  onResume: () => void;
  onComplete: () => void;
}) {
  const due = relativeDue(job.dueDate);
  const late = due.includes("overdue");
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <StatusBadge status={job.status} />
        <span className="text-xs font-semibold uppercase text-slate-500">{job.priority}</span>
      </div>
      <p className="mt-2 text-base font-semibold leading-snug text-slate-900">{job.title}</p>
      <p className="mt-1 text-sm text-slate-700">{locationLabel(job)}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
        <span>{job.woNumber}</span>
        <span className={late ? "font-semibold text-red-700" : ""}>{due}</span>
      </p>
      {sentBackLabel(job) ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm text-amber-950">
          {sentBackLabel(job)}
        </p>
      ) : null}
      <div className="mt-auto pt-3">
        <JobAction job={job} starting={starting} onStart={onStart} onHold={onHold} onResume={onResume} onComplete={onComplete} />
        <Link className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-slate-600 underline-offset-2 hover:underline" href={`/maintenance/jobs?wo=${job.id}` as Route}>
          Open details
        </Link>
      </div>
    </div>
  );
}

function JobAction({
  job,
  starting,
  onStart,
  onHold,
  onResume,
  onComplete
}: {
  job: MyJob;
  starting: boolean;
  onStart: () => void;
  onHold: () => void;
  onResume: () => void;
  onComplete: () => void;
}) {
  if (job.nextAction.kind === "start") {
    return (
      <button
        type="button"
        className="min-h-12 w-full rounded-lg bg-brand-600 px-3 text-base font-semibold text-white disabled:opacity-60"
        disabled={starting}
        onClick={(event) => {
          event.currentTarget.disabled = true;
          onStart();
        }}
      >
        {starting ? "Starting..." : "Start work"}
      </button>
    );
  }
  if (job.status === "IN_PROGRESS") {
    return (
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button type="button" className="min-h-12 rounded-lg bg-brand-600 px-3 text-base font-semibold text-white disabled:opacity-60" disabled={starting} onClick={onComplete}>Finish job</button>
        <button type="button" className="min-h-12 rounded-lg border border-slate-300 px-4 text-sm font-medium disabled:opacity-60" disabled={starting} onClick={onHold}>Hold</button>
      </div>
    );
  }
  if (job.status === "ON_HOLD") {
    return (
      <button type="button" className="min-h-12 w-full rounded-lg bg-brand-600 px-3 text-base font-semibold text-white disabled:opacity-60" disabled={starting} onClick={onResume}>
        Continue work
      </button>
    );
  }
  return (
    <div>
      <Link
        className="flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-brand-600 px-3 text-base font-semibold text-brand-700"
        href={`/maintenance/jobs?wo=${job.id}` as Route}
      >
        {job.nextAction.label}
      </Link>
      {job.nextAction.reason ? <p className="mt-1 text-xs text-slate-600">{job.nextAction.reason}</p> : null}
    </div>
  );
}

function HoldJobDialog({
  job,
  submitting,
  onCancel,
  onSubmit
}: {
  job: MyJob;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (code: MyJobHoldCode, note: string) => Promise<string | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [code, setCode] = useState<MyJobHoldCode>("WAITING_PARTS");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useFocusTrap(true, panelRef, { initialFocusRef: noteRef, onEscape: submitting ? undefined : onCancel });

  async function handleSubmit() {
    const problem = validateHoldNote(note);
    if (problem) {
      setError(problem);
      return;
    }
    setError(await onSubmit(code, note));
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
      <button type="button" aria-label="Close dialog backdrop" className="absolute inset-0" onClick={submitting ? undefined : onCancel} disabled={submitting} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hold-job-title"
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <h2 id="hold-job-title" className="text-lg font-semibold text-slate-900">Hold {job.woNumber}</h2>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-700">Why are you stopping?</legend>
          <div className="mt-2 grid gap-2">
            {MY_JOB_HOLD_CHOICES.map((choice) => (
              <label
                key={choice.code}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm ${
                  code === choice.code ? "border-brand-400 bg-brand-50 font-medium text-slate-900" : "border-slate-200 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="hold-reason"
                  value={choice.code}
                  checked={code === choice.code}
                  disabled={submitting}
                  onChange={() => setCode(choice.code)}
                />
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="hold-job-note">
          Note (required)
        </label>
        <textarea
          id="hold-job-note"
          ref={noteRef}
          rows={2}
          value={note}
          disabled={submitting}
          placeholder={code === "WAITING_PARTS" ? "Which part?" : code === "WAITING_APPROVAL" ? "Whose approval?" : "What is the problem?"}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "hold-job-error" : undefined}
          onChange={(event) => {
            setNote(event.target.value);
            if (error) setError(null);
          }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
        />
        {error ? (
          <p id="hold-job-error" className="mt-1 text-sm text-rose-600" role="alert">{error}</p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={submitting} onClick={onCancel} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-60">
            Cancel
          </button>
          <button type="button" disabled={submitting} onClick={() => void handleSubmit()} className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? "Saving..." : "Put on hold"}
          </button>
        </div>
      </div>
    </div>
  );
}
