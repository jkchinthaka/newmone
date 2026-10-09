"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { OperationalPageHeader } from "@/components/operational/operational-page-header";
import { QueueTabBar } from "@/components/operational/queue-tab-bar";
import { resolveMyJobFilter } from "@/lib/my-job-filters";
import { getVisibleNavigationItems } from "@/lib/navigation";
import { useCurrentUser } from "@/lib/use-current-user";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { humanWorkOrderStatusLabel } from "@/components/work-orders/helpers";
import { ErrorState } from "@/components/ui/page-state";

type NextAction = { kind: "start" | "continue" | "summary" | "open" | "blocked"; label: string; reason?: string };

type MyJob = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  approvalStatus?: string | null;
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

  const allWorkOrders = getVisibleNavigationItems(user.role, { permissions: user.permissions }).find(
    (item) => item.id === "all-jobs" || item.id === "work-orders"
  );

  const filtersActive = Boolean(search || status || priority || due || (view && view !== "active"));

  async function startJob(job: MyJob) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
      setBlocker("You are offline. Start was not sent.");
      return;
    }
    setStartingId(job.id);
    setBlocker(null);
    try {
      await apiClient.post(`/work-orders/${job.id}/start`, {});
      toast.success(`${job.woNumber} started.`);
      await refresh();
    } catch (err) {
      const message = getApiErrorMessage(err, "This job could not be started.");
      setBlocker(message);
      toast.error(message);
      await refresh();
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div className="ops-page">
      <OperationalPageHeader
        title="My Jobs"
        description="Work assigned to you, ordered by urgency."
        actions={
          <>
            {allWorkOrders ? (
              <Link href={allWorkOrders.href as Route} className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-3 text-sm">
                All Work Orders
              </Link>
            ) : null}
            <button type="button" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => void refresh()}>
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
      {forbidden ? <ErrorState title="You cannot view assigned jobs." description={error || "Your role does not include this workspace."} onRetry={() => void refresh()} /> : null}
      {!forbidden && error ? <ErrorState title="We couldn't load your jobs." description={error} onRetry={() => void refresh()} /> : null}

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading jobs">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 && !filtersActive ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">No jobs assigned to you</h2>
          <p className="mt-1 text-sm text-slate-600">When a work order is assigned to your user, it will appear here.</p>
          <button type="button" className="mt-3 min-h-11 rounded border border-slate-300 px-3 text-sm" onClick={() => void refresh()}>Refresh</button>
        </div>
      ) : null}
      {!loading && !error && items.length === 0 && filtersActive ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">No jobs match your filters</h2>
          <button type="button" className="mt-3 min-h-11 rounded border border-slate-300 px-3 text-sm" onClick={() => { setSearchInput(""); writeQuery({ filter: null, view: null, search: null, status: null, priority: null, due: null }); }}>Clear filters</button>
        </div>
      ) : null}

      <ul className="space-y-3 md:hidden">
        {items.map((job) => (
          <li key={job.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <JobBody job={job} starting={startingId === job.id} onStart={() => void startJob(job)} />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Work order</th>
              <th className="px-3 py-2">Asset and location</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Next action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((job) => (
              <tr key={job.id} className="border-b last:border-0">
                <td className="px-3 py-3">
                  <Link className="font-medium text-brand-700 underline" href={`/maintenance/jobs?wo=${job.id}` as Route}>{job.woNumber}</Link>
                  <div className="text-slate-700">{job.title}</div>
                </td>
                <td className="px-3 py-3">{locationLabel(job)}</td>
                <td className="px-3 py-3">{job.priority}</td>
                <td className="px-3 py-3">{humanWorkOrderStatusLabel(job.status)}</td>
                <td className="px-3 py-3">{relativeDue(job.dueDate)}</td>
                <td className="px-3 py-3"><JobAction job={job} starting={startingId === job.id} onStart={() => void startJob(job)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

function JobBody({ job, starting, onStart }: { job: MyJob; starting: boolean; onStart: () => void }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <Link className="font-semibold text-brand-700 underline" href={`/maintenance/jobs?wo=${job.id}` as Route}>{job.woNumber}</Link>
        <span className="text-xs font-medium uppercase text-slate-600">{job.priority}</span>
      </div>
      <p className="mt-1 text-sm text-slate-800">{job.title}</p>
      <p className="mt-1 text-sm text-slate-600">{locationLabel(job)}</p>
      <p className="mt-1 text-sm">{humanWorkOrderStatusLabel(job.status)} · {relativeDue(job.dueDate)}</p>
      <div className="mt-3"><JobAction job={job} starting={starting} onStart={onStart} /></div>
    </div>
  );
}

function JobAction({ job, starting, onStart }: { job: MyJob; starting: boolean; onStart: () => void }) {
  if (job.nextAction.kind === "start") {
    return (
      <button type="button" className="min-h-11 rounded bg-brand-600 px-3 text-sm text-white disabled:opacity-60" disabled={starting} onClick={onStart}>
        {starting ? "Starting..." : "Start work"}
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
