"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Cog,
  Factory,
  Filter,
  ListChecks,
  Package,
  Plus,
  UserRound,
  Wrench
} from "lucide-react";

export type LegacyBoardLane = "machinery" | "service" | "vehicle";
export type LegacyBoardStatus = "In-Progress" | "Pending" | "Completed";

export type LegacyMaintenanceBoardJob = {
  id: string;
  code: string;
  lane: LegacyBoardLane;
  type: string;
  status: LegacyBoardStatus;
  dueDateLabel: string;
  requestDateLabel: string;
  targetLabel: string;
  departmentLabel: string;
  narration: string;
  staff: string[];
  itemsCount: number;
  estimatedHours: string;
  estimatedCost: string;
  actualCost: string;
};

export type LegacyMaintenancePendingRequest = {
  id: string;
  code: string;
  targetLabel: string;
  dateLabel: string;
  typeLabel: string;
};

type StudioStep = "ALLOCATION" | "TIMING" | "PARTS" | "COMPLETION";

type LegacyMaintenanceJobsBoardProps = {
  jobs: LegacyMaintenanceBoardJob[];
  pendingRequests: LegacyMaintenancePendingRequest[];
  onCreateJob: () => void;
  onOpenStudio: (jobId: string, step: StudioStep) => void;
};

const laneConfig: Record<
  LegacyBoardLane,
  {
    label: string;
    icon: typeof CarFront;
  }
> = {
  machinery: {
    label: "Machinery Jobs",
    icon: Factory
  },
  service: {
    label: "Service Jobs",
    icon: Wrench
  },
  vehicle: {
    label: "Vehicle Jobs",
    icon: CarFront
  }
};

const statusStyles: Record<LegacyBoardStatus, string> = {
  "In-Progress": "border-emerald-700/60 bg-emerald-950/40 text-emerald-300",
  Pending: "border-amber-700/60 bg-amber-950/40 text-amber-300",
  Completed: "border-sky-700/60 bg-sky-950/40 text-sky-300"
};

function statValue(jobs: LegacyMaintenanceBoardJob[], status?: LegacyBoardStatus) {
  if (!status) {
    return jobs.length;
  }

  return jobs.filter((job) => job.status === status).length;
}

export function LegacyMaintenanceJobsBoard({
  jobs,
  pendingRequests,
  onCreateJob,
  onOpenStudio
}: LegacyMaintenanceJobsBoardProps) {
  const [activeLane, setActiveLane] = useState<LegacyBoardLane>("machinery");
  const [statusFilter, setStatusFilter] = useState<LegacyBoardStatus | "All">("In-Progress");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"info" | "staff" | "time" | "items" | "summary">("info");

  const laneJobs = useMemo(() => jobs.filter((job) => job.lane === activeLane), [activeLane, jobs]);

  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return laneJobs.filter((job) => {
      const statusMatch = statusFilter === "All" || job.status === statusFilter;
      const textMatch =
        !query ||
        [job.code, job.type, job.targetLabel, job.departmentLabel]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return statusMatch && textMatch;
    });
  }, [laneJobs, searchQuery, statusFilter]);

  useEffect(() => {
    if (filteredJobs.length === 0) {
      setSelectedJobId(null);
      return;
    }

    if (!selectedJobId || !filteredJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(filteredJobs[0].id);
    }
  }, [filteredJobs, selectedJobId]);

  const selectedJob = useMemo(() => filteredJobs.find((job) => job.id === selectedJobId) ?? null, [filteredJobs, selectedJobId]);

  const pendingForLane = useMemo(
    () => pendingRequests.filter((request) => request.typeLabel.toLowerCase() === activeLane),
    [activeLane, pendingRequests]
  );

  return (
    <div className="space-y-5 rounded-3xl border border-slate-700/80 bg-gradient-to-br from-[#090f1f] via-[#0d1529] to-[#120f2a] p-5 text-slate-100 shadow-[0_26px_70px_rgba(2,6,23,0.52)]">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total Jobs</p>
          <p className="mt-2 text-3xl font-semibold text-violet-300">{statValue(jobs)}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">In Progress</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">{statValue(jobs, "In-Progress")}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pending</p>
          <p className="mt-2 text-3xl font-semibold text-amber-300">{statValue(jobs, "Pending")}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Completed</p>
          <p className="mt-2 text-3xl font-semibold text-sky-300">{statValue(jobs, "Completed")}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        <aside className="rounded-2xl border border-slate-700/80 bg-slate-900/75 p-3 backdrop-blur-sm">
          <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Modules</p>
          <div className="mt-3 space-y-1.5">
            {(Object.keys(laneConfig) as LegacyBoardLane[]).map((lane) => {
              const Icon = laneConfig[lane].icon;
              const active = lane === activeLane;

              return (
                <button
                  key={lane}
                  type="button"
                  onClick={() => setActiveLane(lane)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${
                    active
                      ? "border-violet-500/70 bg-violet-500/15 text-violet-200"
                      : "border-transparent bg-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon size={15} />
                  {laneConfig[lane].label}
                </button>
              );
            })}
          </div>

          <div className="my-4 h-px bg-slate-800" />

          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">FMS</p>
          <div className="mt-2 space-y-1.5">
            {[
              { label: "Job Costing", icon: ListChecks },
              { label: "Pending Requests", icon: AlertTriangle },
              { label: "Reports", icon: ClipboardList }
            ].map((entry) => {
              const Icon = entry.icon;

              return (
                <div
                  key={entry.label}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-sm text-slate-400"
                >
                  <Icon size={14} />
                  {entry.label}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="space-y-4 rounded-2xl border border-slate-700/80 bg-slate-900/75 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Maintenance Jobs</p>
              <h2 className="mt-1 text-xl font-semibold text-white">{laneConfig[activeLane].label}</h2>
              <p className="text-sm text-slate-400">{filteredJobs.length} job(s) shown</p>
            </div>
            <button
              type="button"
              onClick={onCreateJob}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:from-violet-400 hover:to-fuchsia-400"
            >
              <Plus size={15} />
              New Job
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm">
              <Filter size={14} className="text-slate-500" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search job, target, or department"
                className="w-full bg-transparent text-slate-200 outline-none placeholder:text-slate-500"
              />
            </div>
            {(["In-Progress", "Pending", "Completed", "All"] as Array<LegacyBoardStatus | "All">).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === status
                    ? "border-violet-500/70 bg-violet-500/20 text-violet-200"
                    : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-600"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {filteredJobs.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-10 text-center text-sm text-slate-500">
                <div>
                  <AlertTriangle size={20} className="mx-auto mb-2" />
                  No jobs match your current filter.
                </div>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => {
                    setSelectedJobId(job.id);
                    setActiveDetailTab("info");
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    selectedJobId === job.id
                      ? "border-violet-500/80 bg-violet-500/15"
                      : "border-slate-700 bg-slate-950/70 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-semibold text-violet-300">{job.code}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">{job.type}</p>
                      <p className="mt-1 text-xs text-slate-400">{job.targetLabel}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyles[job.status]}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={12} /> Due {job.dueDateLabel}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Package size={12} /> {job.itemsCount} item(s)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound size={12} /> {job.staff.length} staff
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-700/80 bg-slate-900/75 p-4 backdrop-blur-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pending Requests</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{laneConfig[activeLane].label}</h3>
          </div>

          <div className="space-y-2.5">
            {pendingForLane.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/70 px-3 py-5 text-sm text-slate-500">
                No pending requests for this module.
              </div>
            ) : (
              pendingForLane.slice(0, 4).map((request) => (
                <div key={request.id} className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm">
                  <p className="font-mono text-xs font-semibold text-violet-300">{request.code}</p>
                  <p className="mt-1 font-medium text-slate-200">{request.targetLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">{request.dateLabel}</p>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Job Detail</p>

            {!selectedJob ? (
              <div className="mt-3 rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-sm text-slate-500">
                Select a job to view details and jump into studio actions.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                  <p className="font-mono text-xs font-semibold text-violet-300">{selectedJob.code}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{selectedJob.type}</p>
                  <p className="mt-1 text-xs text-slate-400">{selectedJob.targetLabel}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {([
                    ["info", "Info", ClipboardList],
                    ["staff", "Staff", UserRound],
                    ["time", "Time", Clock3],
                    ["items", "Items", Package],
                    ["summary", "Summary", CheckCircle2]
                  ] as const).map(([tabId, label, Icon]) => (
                    <button
                      key={tabId}
                      type="button"
                      onClick={() => setActiveDetailTab(tabId)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                        activeDetailTab === tabId
                          ? "border-violet-500/70 bg-violet-500/20 text-violet-200"
                          : "border-slate-700 bg-slate-950/70 text-slate-400"
                      }`}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>

                {activeDetailTab === "info" ? (
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Job Date</span><span>{selectedJob.requestDateLabel}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Due Date</span><span>{selectedJob.dueDateLabel}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Department</span><span>{selectedJob.departmentLabel}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Narration</span><span className="max-w-[190px] text-right">{selectedJob.narration || "-"}</span></div>
                  </div>
                ) : null}

                {activeDetailTab === "staff" ? (
                  <div className="space-y-2 text-xs text-slate-300">
                    <p className="text-slate-500">Assigned Staff</p>
                    {selectedJob.staff.length === 0 ? (
                      <p className="text-slate-500">No staff assigned yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedJob.staff.map((person) => (
                          <span key={person} className="rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1">
                            {person}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenStudio(selectedJob.id, "ALLOCATION")}
                      className="mt-1 inline-flex items-center gap-1 rounded-lg border border-violet-500/60 px-2.5 py-1 text-[11px] font-semibold text-violet-200"
                    >
                      <UserRound size={12} /> Open Allocation
                    </button>
                  </div>
                ) : null}

                {activeDetailTab === "time" ? (
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Estimate</span><span>{selectedJob.estimatedHours}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Est. Cost</span><span>{selectedJob.estimatedCost}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Actual Cost</span><span>{selectedJob.actualCost}</span></div>
                    <button
                      type="button"
                      onClick={() => onOpenStudio(selectedJob.id, "TIMING")}
                      className="mt-1 inline-flex items-center gap-1 rounded-lg border border-violet-500/60 px-2.5 py-1 text-[11px] font-semibold text-violet-200"
                    >
                      <Clock3 size={12} /> Open Time & Fault
                    </button>
                  </div>
                ) : null}

                {activeDetailTab === "items" ? (
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Requested Items</span><span>{selectedJob.itemsCount}</span></div>
                    <button
                      type="button"
                      onClick={() => onOpenStudio(selectedJob.id, "PARTS")}
                      className="mt-1 inline-flex items-center gap-1 rounded-lg border border-violet-500/60 px-2.5 py-1 text-[11px] font-semibold text-violet-200"
                    >
                      <Package size={12} /> Open Item Request
                    </button>
                  </div>
                ) : null}

                {activeDetailTab === "summary" ? (
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Status</span><span>{selectedJob.status}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Type</span><span>{selectedJob.type}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Target</span><span className="max-w-[190px] text-right">{selectedJob.targetLabel}</span></div>
                    <div className="grid gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenStudio(selectedJob.id, "COMPLETION")}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <CheckCircle2 size={13} /> Open Completion
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-400">
        <Cog size={14} className="mt-0.5" />
        This board mirrors your uploaded maintenance-jobs flow while keeping all mutations inside the existing project studio pipeline.
      </div>
    </div>
  );
}
