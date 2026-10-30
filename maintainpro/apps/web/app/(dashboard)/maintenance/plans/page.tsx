"use client";

import { formatDate as lkDate, formatDateTime as lkDateTime } from "@/lib/localization";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { CreatePmPlanDialog } from "@/components/maintenance/create-pm-plan-dialog";
import { JobsPagination } from "@/components/operational/jobs-pagination";
import { OperationalPageHeader } from "@/components/operational/operational-page-header";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/dashboard";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatQueueDue } from "@/lib/work-order-queue-nav";
import { useCurrentUser } from "@/lib/use-current-user";
import { pmPlanListParams, pmPlanStateFromSearch, pmSummaryHint } from "@/lib/pm-plan-list";
import {
  autoCreatePmWorkOrder,
  createPmPlan,
  listPmPlans,
  revisePmPlan,
  type PmPlan
} from "@/lib/planning-api";

const MANAGE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "FACILITY_MANAGER"]);

function statusLabel(status: string) {
  if (status === "INACTIVE") return "Paused";
  if (status === "RETIRED") return "Archived";
  if (status === "DRAFT") return "Draft";
  if (status === "ACTIVE") return "Active";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function triggerLabel(plan: PmPlan) {
  const triggers = plan.triggers ?? [];
  if (!triggers.length) return "No trigger";
  if (triggers.length > 1) return "Whichever comes first";
  const trigger = triggers[0];
  if (trigger.kind === "CALENDAR" && trigger.intervalDays) return `Every ${trigger.intervalDays} days`;
  if (trigger.kind === "METER" && trigger.intervalValue) {
    return `Every ${Number(trigger.intervalValue).toLocaleString("en-US")} ${trigger.unit || "units"}`;
  }
  return trigger.kind === "CALENDAR" ? "Calendar-based" : trigger.kind === "METER" ? "Meter-based" : trigger.kind;
}

function scopeLabel(plan: PmPlan) {
  if (plan.vehicle) return `${plan.vehicle.make} ${plan.vehicle.vehicleModel}`.trim() || plan.vehicle.registrationNo;
  if (plan.asset) return plan.asset.name;
  return "No asset assigned";
}

function scopeCode(plan: PmPlan) {
  return plan.vehicle?.registrationNo || plan.asset?.assetTag || "";
}

function attentionLabel(plan: PmPlan) {
  if (!plan.asset && !plan.vehicle) return "Missing asset";
  if (plan.dueState === "OVERDUE") return "Overdue";
  if (plan.dueState === "NEEDS_ATTENTION") return "Recalculate due";
  if (plan.dueState === "DUE_SOON") return "Due soon";
  return "Ready";
}

export default function PreventiveMaintenancePage() {
  const user = useCurrentUser();
  const canManage = MANAGE_ROLES.has(user.role ?? "") || user.permissions.includes("planning.manage");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = pmPlanStateFromSearch(params);
  const [draft, setDraft] = useState(state.q ?? "");
  const [items, setItems] = useState<PmPlan[]>([]);
  const [summary, setSummary] = useState({ active: 0, dueIn7: 0, overdue: 0, needsAttention: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [moreFilters, setMoreFilters] = useState(false);
  const [layout, setLayout] = useState<"list" | "calendar" | null>(null);

  const write = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    next.delete("view");
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  };

  useEffect(() => {
    setDraft(state.q ?? "");
  }, [state.q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft.trim() === (state.q ?? "")) return;
      write({ q: draft.trim() || null });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listPmPlans(pmPlanListParams(state))
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setSummary(result.summary);
        setTotal(result.meta.total);
        setTotalPages(result.meta.totalPages);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "We couldn't load scheduled service plans."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  async function setPlanStatus(plan: PmPlan, status: string, reason: string) {
    try {
      await revisePmPlan(plan.id, { status }, reason);
      toast.success(`${plan.code} updated`);
      write({ refresh: String(Date.now()) }, false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Plan update failed"));
    }
  }

  const chips = [
    state.status ? { key: "status", label: statusLabel(state.status) } : null,
    state.due === "overdue" ? { key: "due", label: "Overdue" } : null,
    state.due === "soon" ? { key: "due", label: "Due soon" } : null,
    state.attention ? { key: "attention", label: "Needs attention" } : null,
    state.trigger ? { key: "trigger", label: state.trigger === "CALENDAR" ? "Calendar" : "Meter" } : null,
    state.q ? { key: "q", label: state.q } : null
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));

  const filtered = chips.length > 0;
  const hasDates = items.some((plan) => Boolean(plan.nextDueAt));
  const viewMode = layout ?? (hasDates ? "calendar" : "list");
  const dueNext = [...items].filter((plan) => plan.nextDueAt).sort((a, b) => String(a.nextDueAt).localeCompare(String(b.nextDueAt))).slice(0, 6);

  return (
    <div className="min-w-0 space-y-3 p-4 md:p-6">
      <PageBreadcrumbs />
      <OperationalPageHeader
        title="Scheduled Service"
        description="Recurring plans, triggers, and the next due date."
        actions={
          canManage ? (
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              onClick={() => {
                setCreateError(null);
                setWizard(true);
              }}
            >
              <Plus size={16} aria-hidden /> Create scheduled service plan
            </button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Scheduled service summary">
        {(
          [
            {
              key: "active" as const,
              label: "Active",
              value: summary.active,
              pressed: state.status === "ACTIVE" && !state.due && !state.attention,
              patch: { status: state.status === "ACTIVE" && !state.due && !state.attention ? null : "ACTIVE", due: null, attention: null }
            },
            {
              key: "soon" as const,
              label: "Due soon",
              value: summary.dueIn7,
              pressed: state.due === "soon",
              patch: { due: state.due === "soon" ? null : "soon", attention: null }
            },
            {
              key: "overdue" as const,
              label: "Overdue",
              value: summary.overdue,
              pressed: state.due === "overdue",
              patch: { due: state.due === "overdue" ? null : "overdue", attention: null }
            },
            {
              key: "attention" as const,
              label: "Needs attention",
              value: summary.needsAttention,
              pressed: state.attention === "true",
              patch: { attention: state.attention ? null : "true", due: null }
            }
          ]
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.pressed}
            title={pmSummaryHint(item.key)}
            className={`rounded-card border bg-white p-4 text-left shadow-card ${
              item.pressed ? "border-brand-600" : "border-slate-200"
            }`}
            onClick={() => write(item.patch as Record<string, string | null>)}
          >
            <span className="block text-sm text-slate-600">{item.label}</span>
            <span className="mt-2 block text-2xl font-semibold text-slate-900">{item.value}</span>
          </button>
        ))}
      </div>
      {state.due === "soon" || state.due === "overdue" || state.attention === "true" || (state.status === "ACTIVE" && !state.due && !state.attention) ? (
        <p className="text-sm text-slate-600">
          {pmSummaryHint(state.attention === "true" ? "attention" : state.due === "soon" ? "soon" : state.due === "overdue" ? "overdue" : "active")}
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search plan, code, or asset"
            aria-label="Search scheduled service plans"
            className="h-10 min-w-[12rem] flex-1 rounded-md border border-slate-300 px-3 text-sm"
          />
          <button type="button" className="h-10 px-2 text-sm font-medium" aria-expanded={moreFilters} onClick={() => setMoreFilters((open) => !open)}>
            More filters
          </button>
          {filtered ? (
            <button type="button" className="h-10 px-2 text-sm font-medium" onClick={() => write({ status: null, due: null, attention: null, trigger: null, q: null, assetId: null })}>
              Clear
            </button>
          ) : null}
        </div>
        {moreFilters ? (
          <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-slate-700">
              Status
              <select
                aria-label="Status"
                className="mt-1 h-10 w-full rounded-md border px-2"
                value={state.status ?? ""}
                onChange={(event) => write({ status: event.target.value || null })}
              >
                <option value="">Any</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Paused</option>
                <option value="DRAFT">Draft</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Trigger
              <select
                aria-label="Trigger type"
                className="mt-1 h-10 w-full rounded-md border px-2"
                value={state.trigger ?? ""}
                onChange={(event) => write({ trigger: event.target.value || null })}
              >
                <option value="">Any</option>
                <option value="CALENDAR">Calendar</option>
                <option value="METER">Meter</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Due window
              <select
                aria-label="Due window"
                className="mt-1 h-10 w-full rounded-md border px-2"
                value={state.attention ? "attention" : state.due ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "attention") write({ attention: "true", due: null });
                  else write({ due: value || null, attention: null });
                }}
              >
                <option value="">Any</option>
                <option value="soon">Due soon</option>
                <option value="overdue">Overdue</option>
                <option value="attention">Needs attention</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Auto job
              <select
                aria-label="Auto job"
                className="mt-1 h-10 w-full rounded-md border px-2"
                value={params.get("autoWo") ?? ""}
                onChange={(event) => write({ autoWo: event.target.value || null })}
              >
                <option value="">Any</option>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
          </div>
        ) : null}
        {chips.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Active</span>
            {chips.map((chip) => (
              <button key={chip.key} type="button" className="rounded-full bg-slate-100 px-2 py-1 text-xs" onClick={() => write({ [chip.key]: null })}>
                {chip.label} ×
              </button>
            ))}
            <button type="button" className="text-xs font-medium text-slate-700" onClick={() => write({ status: null, due: null, attention: null, trigger: null, q: null, assetId: null })}>
              Clear all
            </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <ErrorState message={`We couldn't load scheduled service plans. ${error}`} onRetry={() => write({ retry: String(Date.now()) }, false)} />
      ) : null}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading plans">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No scheduled service plans match these filters."
          description="Clear the filters or create a plan when you are allowed to."
          action={
            <div className="flex items-center justify-center gap-3">
              {filtered ? (
                <button type="button" className="text-sm font-medium text-brand-700" onClick={() => write({ status: null, due: null, attention: null, trigger: null, q: null, assetId: null })}>
                  Clear filters
                </button>
              ) : null}
              {canManage ? (
                <button type="button" className="text-sm font-medium text-slate-700" onClick={() => setWizard(true)}>
                  Create scheduled service plan
                </button>
              ) : null}
            </div>
          }
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Plan layout">
            <button type="button" aria-pressed={viewMode === "calendar"} disabled={!hasDates} className={`min-h-11 rounded-md px-3 text-sm ${viewMode === "calendar" ? "bg-brand-600 text-white" : "border border-slate-300 bg-white"}`} onClick={() => setLayout("calendar")}>Calendar</button>
            <button type="button" aria-pressed={viewMode === "list"} className={`min-h-11 rounded-md px-3 text-sm ${viewMode === "list" ? "bg-brand-600 text-white" : "border border-slate-300 bg-white"}`} onClick={() => setLayout("list")}>List</button>
          </div>
          {viewMode === "calendar" ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <PmMonthCalendar plans={items} />
              <section className="rounded-card border border-slate-200 bg-white p-4 shadow-card">
                <h2 className="text-sm font-semibold text-slate-900">Due next</h2>
                <ul className="mt-3 space-y-3">
                  {dueNext.length === 0 ? <li className="text-sm text-slate-600">No dated plans in this list.</li> : dueNext.map((plan) => (
                    <li key={plan.id} className="border-b border-slate-100 pb-2 text-sm last:border-0">
                      <p className="font-medium text-slate-900">{plan.name}</p>
                      <p className="text-xs text-slate-500">{scopeLabel(plan)} · {plan.nextDueAt ? lkDate(plan.nextDueAt) : ""}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
          {viewMode === "list" ? (
          <div className="hidden overflow-x-auto rounded-card border border-slate-200 bg-white shadow-card md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Asset / Scope</th>
                  <th className="px-3 py-2 font-medium">Trigger</th>
                  <th className="px-3 py-2 font-medium">Next due</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="hidden px-3 py-2 font-medium xl:table-cell">Auto job</th>
                  <th className="px-3 py-2 font-medium">Next action</th>
                  <th className="px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((plan) => {
                  const overdueDays = plan.remainingDays != null && plan.remainingDays < 0 ? Math.ceil(Math.abs(plan.remainingDays)) : 0;
                  const due = formatQueueDue(plan.nextDueAt, overdueDays);
                  return (
                    <tr key={plan.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium text-slate-900">{plan.name}</div>
                        <div className="text-xs text-slate-500">{plan.code}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div>{scopeLabel(plan)}</div>
                        {scopeCode(plan) ? <div className="text-xs text-slate-500">{scopeCode(plan)}</div> : null}
                      </td>
                      <td className="px-3 py-3 align-top">{triggerLabel(plan)}</td>
                      <td className="px-3 py-3 align-top">
                        <div className={due.overdue ? "font-medium text-red-700" : undefined}>{plan.nextDueAt ? due.date : "Not scheduled"}</div>
                        {due.hint ? <div className={`text-xs ${due.overdue ? "text-red-700" : "text-slate-500"}`}>{due.hint}</div> : null}
                      </td>
                      <td className="px-3 py-3 align-top">{statusLabel(plan.status)}</td>
                      <td className="hidden px-3 py-3 align-top xl:table-cell">{plan.autoCreateWorkOrder ? "Enabled" : "Disabled"}</td>
                      <td className="px-3 py-3 align-top">{attentionLabel(plan)}</td>
                      <td className="px-3 py-3 align-top">
                        <details className="text-sm">
                          <summary className="cursor-pointer font-medium text-brand-700">Actions</summary>
                          <div className="mt-1 grid gap-1">
                            {plan.workOrders?.[0] ? (
                              <Link className="text-brand-700" href={`/work-orders?wo=${plan.workOrders[0].id}` as Route}>
                                Open {plan.workOrders[0].woNumber}
                              </Link>
                            ) : null}
                            {canManage && plan.status === "DRAFT" && (plan.assetId || plan.vehicleId) ? (
                              <button type="button" className="text-left text-brand-700" onClick={() => void setPlanStatus(plan, "ACTIVE", "Activated")}>Activate</button>
                            ) : null}
                            {canManage && plan.status === "ACTIVE" ? (
                              <button type="button" className="text-left text-brand-700" onClick={() => void setPlanStatus(plan, "INACTIVE", "Paused")}>Pause</button>
                            ) : null}
                            {canManage && plan.status === "INACTIVE" && (plan.assetId || plan.vehicleId) ? (
                              <button type="button" className="text-left text-brand-700" onClick={() => void setPlanStatus(plan, "ACTIVE", "Resumed")}>Activate</button>
                            ) : null}
                            {canManage && plan.autoCreateWorkOrder && plan.status === "ACTIVE" ? (
                              <button
                                type="button"
                                className="text-left text-brand-700"
                                onClick={async () => {
                                  try {
                                    const result = await autoCreatePmWorkOrder(plan.id);
                                    toast.success(String((result as { reason?: string })?.reason ?? "Evaluated"));
                                    write({ refresh: String(Date.now()) }, false);
                                  } catch (err) {
                                    toast.error(getApiErrorMessage(err, "Auto job failed"));
                                  }
                                }}
                              >
                                Evaluate due
                              </button>
                            ) : null}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          ) : null}
          <div className={`space-y-2 md:hidden ${viewMode === "list" ? "" : "hidden"}`}>
            {items.map((plan) => (
              <article key={plan.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{plan.name}</p>
                    <p className="text-xs text-slate-500">{plan.code}</p>
                  </div>
                  <span>{statusLabel(plan.status)}</span>
                </div>
                <p className="mt-1">{scopeLabel(plan)}</p>
                <p className="text-slate-600">{triggerLabel(plan)}</p>
                <p className="text-slate-600">{attentionLabel(plan)}</p>
              </article>
            ))}
          </div>
          <JobsPagination
            page={state.page}
            totalPages={totalPages}
            total={total}
            pageSize={state.pageSize}
            onPageChange={(page) => write({ page: String(page) }, false)}
            onPageSizeChange={(pageSize) => write({ pageSize: String(pageSize) })}
          />
        </>
      ) : null}

      {wizard ? (
        <CreatePmPlanDialog
          busy={busy}
          error={createError}
          onClose={() => setWizard(false)}
          onSubmit={async (values, activate) => {
            setBusy(true);
            setCreateError(null);
            try {
              const year = new Date().getFullYear();
              const code = `PM-${year}-${String(Date.now()).slice(-4)}`;
              await createPmPlan({
                code,
                name: values.name,
                description: values.description || undefined,
                status: activate ? "ACTIVE" : "DRAFT",
                assetId: values.assetId || undefined,
                vehicleId: values.vehicleId || undefined,
                autoCreateWorkOrder: values.autoWo,
                combineMode: "EARLIEST",
                effectiveFrom: values.effectiveFrom || undefined,
                triggers:
                  values.trigger === "HYBRID"
                    ? [
                        { kind: "CALENDAR", intervalDays: values.intervalDays },
                        { kind: "METER", intervalValue: values.intervalValue, unit: values.unit || "hrs" }
                      ]
                    : values.trigger === "METER"
                      ? [{ kind: "METER", intervalValue: values.intervalValue, unit: values.unit || "hrs" }]
                      : [{ kind: "CALENDAR", intervalDays: values.intervalDays }]
              });
              toast.success(activate ? "Plan activated" : "Draft saved");
              setWizard(false);
              write({ refresh: String(Date.now()) }, false);
            } catch (err) {
              setCreateError(getApiErrorMessage(err, "Could not save the plan"));
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function PmMonthCalendar({ plans }: { plans: PmPlan[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [...Array.from({ length: pad }, () => null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const onDay = (day: number) =>
    plans.filter((plan) => {
      if (!plan.nextDueAt) return false;
      const due = new Date(plan.nextDueAt);
      return due.getFullYear() === year && due.getMonth() === month && due.getDate() === day;
    });

  return (
    <section className="rounded-card border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}</h2>
        <div className="flex gap-2">
          <button type="button" className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month">‹</button>
          <button type="button" className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" onClick={() => setCursor(new Date())}>Today</button>
          <button type="button" className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div key={label} className="py-1">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          const entries = day ? onDay(day) : [];
          return (
            <div key={`${day ?? "x"}-${index}`} className="min-h-16 rounded-md border border-slate-100 p-1 text-xs">
              <span className="text-slate-500">{day ?? ""}</span>
              {entries.slice(0, 2).map((plan) => (
                <p key={plan.id} className={`mt-1 truncate rounded px-1 ${plan.remainingDays != null && plan.remainingDays < 0 ? "bg-red-50 text-red-800" : "bg-brand-50 text-brand-800"}`}>{plan.name}</p>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
