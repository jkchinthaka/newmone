"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ClipboardList, Clock3, PauseCircle } from "lucide-react";

import { OperationalPageHeader } from "@/components/operational/operational-page-header";
import { QueueTabBar } from "@/components/operational/queue-tab-bar";
import { EmptyState, ErrorState, KpiCard, SkeletonCard, StatusBadge } from "@/components/ui/dashboard";
import { resolveMyJobFilter, myJobPurpose } from "@/lib/my-job-filters";
import { getVisibleNavigationItems } from "@/lib/navigation";
import { useCurrentUser } from "@/lib/use-current-user";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { JOB_CHANGED_MESSAGE, classifyJobActionError } from "@/lib/job-action-outcome";
import { mutationErrorMessage, showMutationError } from "@/lib/mutation-feedback";
import { humanWorkOrderStatusLabel } from "@/components/work-orders/helpers";
import { usePromptDialog } from "@/components/ui/use-prompt-dialog";

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

const VIEWS = [
  ["active", "Active", "active"],
  ["due-today", "Due today", "dueToday"],
  ["overdue", "Overdue", "overdue"],
  ["waiting-parts", "Waiting parts", "waitingParts"],
  ["evidence-needed", "Evidence needed", "evidenceNeeded"],
  ["rework-required", "Rework required", "reworkRequired"],
  ["in-progress", "In progress", "inProgress"],
  ["completed", "Completed", "completed"]
] as const;

function relativeDue(value?: string | null) {
  if (!value) return "No due date";
  const due = new Date(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dueStart = new Date(due);
  dueStart.setHours(0, 0, 0, 0);
  const days = Math.round((dueStart.getTime() - start.getTime()) / 86_400_000);
  const date = due.toLocaleDateString();
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
  const user = useCurrentUser();
  const { prompt, dialog } = usePromptDialog();
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

  const refresh = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
      setLoading(false);
      setError("You are offline. Assigned jobs cannot be refreshed until the connection returns.");
      return;
    }
    setLoading(true);
    setError(null);
    setForbidden(false);
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
    } catch (err) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode === 401 || statusCode === 403) {
        setForbidden(true);
        setItems([]);
        setCounts(null);
      }
      setCapped(false);
      setError(getApiErrorMessage(err, "We couldn't load your jobs."));
    } finally {
      setLoading(false);
    }
  }, [due, page, priority, search, status, view]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const allWorkOrders = getVisibleNavigationItems(user.role, user).find(
    (item) => item.id === "all-jobs" || item.id === "work-orders"
  );

  const filtersActive = Boolean(search || status || priority || due || (view && view !== "active"));
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const listKpis = {
    active: items.filter((job) => !["COMPLETED", "CLOSED", "CANCELLED", "VERIFIED"].includes(job.status)).length,
    dueToday: items.filter((job) => {
      if (!job.dueDate) return false;
      const due = new Date(job.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === todayStart.getTime();
    }).length,
    onHold: items.filter((job) => job.status === "ON_HOLD").length
  };

  async function startJob(job: MyJob) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
      setBlocker("You are offline. Start was not sent.");
      return;
    }
    setStartingId(job.id);
    setBlocker(null);
    try {
      await apiClient.post(`/work-orders/${job.id}/start`, { expectedVersion: job.version });
      toast.success(`${job.woNumber} started.`);
      await refresh();
    } catch (err) {
      const outcome = classifyJobActionError(err);
      if (outcome === "conflict") {
        // Someone else changed the job: show the fresh row and keep the user here.
        toast.message(JOB_CHANGED_MESSAGE);
        await refresh();
      } else if (outcome === "unavailable") {
        setBlocker(mutationErrorMessage(err, "This job could not be started."));
        showMutationError(err, "This job could not be started.", () => void startJob(job));
      } else {
        const message = mutationErrorMessage(err, "This job could not be started.");
        setBlocker(message);
        toast.error(message);
        await refresh();
      }
    } finally {
      setStartingId(null);
    }
  }

  async function holdJob(job: MyJob) {
    const reason = await prompt({
      title: `Hold ${job.woNumber}`,
      label: "Reason",
      required: true
    });
    if (!reason?.trim()) return;
    setStartingId(job.id);
    try {
      await apiClient.post(`/work-orders/${job.id}/hold`, {
        holdReasonCode: "OTHER",
        delayReason: reason.trim(),
        expectedVersion: job.version
      });
      toast.success(`${job.woNumber} placed on hold.`);
      await refresh();
    } catch (err) {
      toast.error(mutationErrorMessage(err, "This job could not be placed on hold."));
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

  async function completeJob(job: MyJob) {
    const note = await prompt({
      title: `Complete ${job.woNumber}`,
      label: "Completion note",
      required: true
    });
    if (!note?.trim()) return;
    setStartingId(job.id);
    try {
      await apiClient.post(`/work-orders/${job.id}/complete-technician`, {
        completionNote: note.trim(),
        expectedVersion: job.version
      });
      toast.success(`${job.woNumber} submitted for verification.`);
      await refresh();
    } catch (err) {
      toast.error(mutationErrorMessage(err, "This job could not be completed."));
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div className="ops-page pb-24 md:pb-0">
      <OperationalPageHeader
        title="My Jobs"
        description="Jobs assigned to you, most urgent first."
        actions={
          <>
            {allWorkOrders ? (
              <Link href={allWorkOrders.href as Route} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm">
                All Work Orders
              </Link>
            ) : null}
            <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => void refresh()}>
              Refresh
            </button>
          </>
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <QueueTabBar
          label="My jobs"
          selectedKey={view}
          moreOpen={moreViewsOpen}
          onMoreOpenChange={setMoreViewsOpen}
          onSelect={(key) => writeQuery({ filter: key, view: null })}
          primary={VIEWS.slice(0, 4).map(([key, label, countKey]) => ({
            key,
            label,
            count: counts ? counts[countKey] : undefined
          }))}
          more={VIEWS.slice(4).map(([key, label, countKey]) => ({
            key,
            label,
            count: counts ? counts[countKey] : undefined
          }))}
        />
      </div>
      <p className="text-sm text-slate-600">{myJobPurpose(view)}</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Active" value={String(listKpis.active)} icon={ClipboardList} tone="brand" />
        <KpiCard label="Due today" value={String(listKpis.dueToday)} icon={Clock3} tone="red" />
        <KpiCard label="On hold" value={String(listKpis.onHold)} icon={PauseCircle} tone="amber" />
      </div>

      <form
        className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          writeQuery({ search: searchInput || null });
        }}
      >
        <label className="text-sm">
          Search
          <input className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="WO number, title, or asset" />
        </label>
        <label className="text-sm">
          Status
          <select className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={status} onChange={(event) => writeQuery({ status: event.target.value || null })}>
            <option value="">Any</option>
            {["OPEN", "PLANNED", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "OVERDUE", "REWORK_REQUIRED", "TECHNICIAN_COMPLETED", "VERIFIED", "COMPLETED", "CLOSED"].map((item) => (
              <option key={item} value={item}>{humanWorkOrderStatusLabel(item)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Priority
          <select className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={priority} onChange={(event) => writeQuery({ priority: event.target.value || null })}>
            <option value="">Any</option>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Due date
          <select className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={due} onChange={(event) => writeQuery({ due: event.target.value || null })}>
            <option value="">Any</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="none">No due date</option>
          </select>
        </label>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>{loading ? "Loading results" : `${total} job${total === 1 ? "" : "s"}`}</span>
        {filtersActive ? (
          <button type="button" className="min-h-11 rounded border border-slate-300 px-3" onClick={() => { setSearchInput(""); writeQuery({ filter: null, view: null, search: null, status: null, priority: null, due: null }); }}>
            Clear filters
          </button>
        ) : null}
      </div>

      {capped ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">Showing the first 500 assigned jobs. Narrow the list with search if you cannot find a job.</p> : null}
      {blocker ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">{blocker}</p> : null}
      {dialog}
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
          description="When a work order is assigned to your user, it will appear here."
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
            <li key={job.id} className="rounded-card border border-slate-200 bg-white p-4 shadow-card">
              <JobBody
                job={job}
                starting={startingId === job.id}
                onStart={() => void startJob(job)}
                onHold={() => void holdJob(job)}
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
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <StatusBadge status={job.status} />
        <span className="text-xs font-medium uppercase text-slate-500">{job.priority}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{job.woNumber}</p>
      <p className="text-sm font-semibold text-slate-900">{job.title}</p>
      <p className="mt-1 text-sm text-slate-600">{locationLabel(job)}</p>
      <p className="mt-1 text-xs text-slate-500">{relativeDue(job.dueDate)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <JobAction job={job} starting={starting} onStart={onStart} onHold={onHold} onResume={onResume} onComplete={onComplete} />
        <Link className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-800" href={`/maintenance/jobs?wo=${job.id}` as Route}>Open</Link>
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
        className="min-h-11 rounded-md bg-brand-600 px-3 text-sm font-medium text-white disabled:opacity-60"
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
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-md border border-slate-300 px-3 text-sm disabled:opacity-60" disabled={starting} onClick={onHold}>Hold</button>
        <button type="button" className="min-h-11 rounded-md bg-brand-600 px-3 text-sm font-medium text-white disabled:opacity-60" disabled={starting} onClick={onComplete}>Complete</button>
      </div>
    );
  }
  if (job.status === "ON_HOLD") {
    return (
      <button type="button" className="min-h-11 rounded-md bg-brand-600 px-3 text-sm font-medium text-white disabled:opacity-60" disabled={starting} onClick={onResume}>
        Resume
      </button>
    );
  }
  return (
    <div>
      <Link className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700 underline" href={`/maintenance/jobs?wo=${job.id}` as Route}>
        {job.nextAction.label}
      </Link>
      {job.nextAction.reason ? <p className="mt-1 text-xs text-slate-600">{job.nextAction.reason}</p> : null}
    </div>
  );
}
