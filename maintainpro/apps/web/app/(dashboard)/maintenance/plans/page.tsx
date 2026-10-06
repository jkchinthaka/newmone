"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { formatEnumLabel } from "@/lib/display-labels";
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
  return status.charAt(0) + status.slice(1).toLowerCase();
}

const VALIDITY_ISSUE_LABELS: Record<string, string> = {
  NO_ASSET_ASSIGNED: "No asset or vehicle assigned",
  NO_TRIGGER: "No active trigger"
};

function dueLabel(state?: string) {
  if (state === "INVALID") return "Invalid — fix required";
  if (state === "DUE_SOON") return "Due Soon";
  if (state === "NEEDS_ATTENTION") return "Needs Attention";
  if (state === "ON_TRACK") return "On Track";
  if (!state) return "—";
  return state.charAt(0) + state.slice(1).toLowerCase();
}

function triggerLabel(plan: PmPlan) {
  const triggers = plan.triggers ?? [];
  if (!triggers.length) return "No trigger";
  if (triggers.length > 1) return "Whichever comes first";
  const trigger = triggers[0];
  if (trigger.kind === "CALENDAR" && trigger.intervalDays) return `Every ${trigger.intervalDays} days`;
  if (trigger.kind === "METER" && trigger.intervalValue) {
    return `Every ${trigger.intervalValue} ${trigger.unit || "units"}`;
  }
  return trigger.kind;
}

function scopeLabel(plan: PmPlan) {
  if (plan.vehicle) return `${plan.vehicle.make} ${plan.vehicle.vehicleModel}`.trim() || plan.vehicle.registrationNo;
  if (plan.asset) return plan.asset.name;
  return "No asset assigned";
}

function pmEvaluationMessage(result: { created?: boolean; reason?: string } | null | undefined) {
  if (result?.created) return "Preventive work order created.";
  switch (result?.reason) {
    case "NOT_DUE":
      return "Not due yet — no work order created.";
    case "DUPLICATE_OPEN_WO":
      return "An open work order already exists for this plan.";
    case "DUPLICATE_GENERATION_KEY":
      return "A work order was already generated for this due date.";
    case "AUTO_WO_DISABLED":
      return "Automatic work orders are disabled for this plan.";
    default:
      return result?.reason ? formatEnumLabel(result.reason) : "Plan evaluated.";
  }
}

function scopeCode(plan: PmPlan) {
  return plan.vehicle?.registrationNo || plan.asset?.assetTag || "";
}

export default function PreventiveMaintenancePage() {
  const user = useCurrentUser();
  const canManage = MANAGE_ROLES.has(user.role ?? "") || user.permissions.includes("planning.manage");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view") ?? "all";
  const queryText = params.get("q") ?? "";
  const trigger = params.get("trigger") ?? "";
  const page = Math.max(Number(params.get("page") ?? "1") || 1, 1);
  const [draft, setDraft] = useState(queryText);
  const [items, setItems] = useState<PmPlan[]>([]);
  const [summary, setSummary] = useState({ active: 0, dueIn7: 0, overdue: 0, needsAttention: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [busy, setBusy] = useState(false);

  const write = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft.trim() === queryText.trim()) return;
      write({ q: draft.trim() || null });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const status =
      view === "active" ? "ACTIVE" : view === "paused" ? "INACTIVE" : view === "draft" ? "DRAFT" : undefined;
    void listPmPlans({
      status,
      search: queryText || undefined,
      trigger: trigger || undefined,
      dueWindow: view === "overdue" ? "overdue" : view === "due" ? "7" : view === "attention" ? "attention" : undefined,
      page,
      pageSize: 25
    })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setSummary(result.summary);
        setTotal(result.meta.total);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "We couldn't load preventive maintenance plans."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, queryText, trigger, page, params]);

  async function setPlanStatus(plan: PmPlan, status: string, reason: string) {
    try {
      await revisePmPlan(plan.id, { status }, reason);
      toast.success(`${plan.code} updated`);
      write({ refresh: String(Date.now()) });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Plan update failed"));
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageBreadcrumbs />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Preventive Maintenance</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Plan recurring maintenance, define triggers, and automatically generate work orders before assets become overdue.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white"
            onClick={() => setWizard(true)}
          >
            <Plus size={16} aria-hidden /> Create PM Plan
          </button>
        ) : null}
      </header>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active Plans", summary.active, "active"],
          ["Due in 7 Days", summary.dueIn7, "due"],
          ["Overdue", summary.overdue, "overdue"],
          ["Needs Attention", summary.needsAttention, "attention"]
        ].map(([label, value, key]) => (
          <button
            key={String(label)}
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left"
            onClick={() => write({ view: String(key) })}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </button>
        ))}
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Quick views">
        {[
          ["all", "All Plans"],
          ["active", "Active"],
          ["due", "Due Soon"],
          ["overdue", "Overdue"],
          ["paused", "Paused"],
          ["attention", "Needs Attention"]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-selected={view === id}
            className={`min-h-11 rounded-lg px-3 text-sm ${view === id ? "bg-brand-600 text-white" : "border border-slate-200 bg-white"}`}
            onClick={() => write({ view: id === "all" ? null : id })}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1.4fr)_220px]">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search plan, asset, task or code..."
          aria-label="Search preventive maintenance plans"
          className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
        />
        <select
          aria-label="Trigger type"
          className="min-h-11 rounded-lg border px-2 text-sm"
          value={trigger}
          onChange={(event) => write({ trigger: event.target.value || null })}
        >
          <option value="">Trigger type</option>
          <option value="CALENDAR">Calendar</option>
          <option value="METER">Meter</option>
        </select>
      </section>
      <p className="text-sm text-slate-600">
        {total} plan{total === 1 ? "" : "s"}
      </p>

      {error ? (
        <ErrorState
          title="We couldn't load preventive maintenance plans."
          description={error}
          onRetry={() => write({ retry: String(Date.now()) })}
          retryLabel="Retry"
        />
      ) : null}
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <p className="font-medium text-slate-900">No preventive maintenance plans yet.</p>
          <p className="mt-1 text-sm text-slate-600">
            Create a preventive maintenance plan to schedule recurring service and automatically generate work before assets become overdue.
          </p>
          {canManage ? (
            <button type="button" className="mt-4 min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white" onClick={() => setWizard(true)}>
              Create PM Plan
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Asset / scope</th>
                <th className="px-3 py-2">Trigger</th>
                <th className="px-3 py-2">Next due</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Auto WO</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((plan) => (
                <tr key={plan.id} className="border-t">
                  <td className="px-3 py-3">
                    <div className="font-semibold">{plan.code}</div>
                    <div className="text-slate-700">{plan.name}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className={plan.validityIssues?.includes("NO_ASSET_ASSIGNED") ? "font-semibold text-rose-700" : undefined}>
                      {scopeLabel(plan)}
                    </div>
                    {scopeCode(plan) ? <div className="text-xs text-slate-500">{scopeCode(plan)}</div> : null}
                    {plan.validityIssues?.length ? (
                      <div
                        role="status"
                        className="mt-1 inline-block rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
                      >
                        Invalid plan: {plan.validityIssues.map((issue) => VALIDITY_ISSUE_LABELS[issue] ?? issue).join(", ")}.
                        Assign an asset or pause this plan.
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{triggerLabel(plan)}</td>
                  <td className="px-3 py-3">
                    <div>{plan.nextDueAt ? new Date(plan.nextDueAt).toLocaleDateString() : "—"}</div>
                    {plan.nextDueSource === "PROJECTED" ? (
                      <div className="text-xs text-slate-500">Calculated from schedule</div>
                    ) : null}
                    <div className="text-xs text-slate-500">{dueLabel(plan.dueState)}</div>
                    {plan.remainingDays != null ? (
                      <div className="text-xs text-slate-500">{Math.round(plan.remainingDays)} days</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    {statusLabel(plan.status)}
                    {plan.validityIssues?.length ? <div className="text-xs font-semibold text-rose-700">Needs remediation</div> : null}
                  </td>
                  <td className="px-3 py-3">{plan.autoCreateWorkOrder ? "Enabled" : "Disabled"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-1">
                      {plan.workOrders?.[0] ? (
                        <Link className="text-brand-700" href={`/work-orders?wo=${plan.workOrders[0].id}` as Route}>
                          {plan.workOrders[0].woNumber}
                        </Link>
                      ) : null}
                      {canManage && plan.status === "DRAFT" ? (
                        <button type="button" className="text-brand-700" onClick={() => void setPlanStatus(plan, "ACTIVE", "Activated")}>
                          Activate
                        </button>
                      ) : null}
                      {canManage && plan.status === "ACTIVE" ? (
                        <button type="button" className="text-brand-700" onClick={() => void setPlanStatus(plan, "INACTIVE", "Paused")}>
                          Pause
                        </button>
                      ) : null}
                      {canManage && plan.status === "INACTIVE" ? (
                        <button type="button" className="text-brand-700" onClick={() => void setPlanStatus(plan, "ACTIVE", "Resumed")}>
                          Resume
                        </button>
                      ) : null}
                      {canManage && plan.status !== "RETIRED" ? (
                        <button type="button" className="text-slate-600" onClick={() => void setPlanStatus(plan, "RETIRED", "Archived")}>
                          Archive
                        </button>
                      ) : null}
                      {canManage && plan.autoCreateWorkOrder && plan.status === "ACTIVE" && !plan.validityIssues?.length ? (
                        <button
                          type="button"
                          className="text-brand-700"
                          onClick={async () => {
                            try {
                              const result = await autoCreatePmWorkOrder(plan.id);
                              toast.success(pmEvaluationMessage(result as { created?: boolean; reason?: string }));
                              write({ refresh: String(Date.now()) });
                            } catch (err) {
                              toast.error(getApiErrorMessage(err, "Auto work order failed"));
                            }
                          }}
                        >
                          Evaluate due
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {wizard ? (
        <CreatePlanWizard
          busy={busy}
          onClose={() => setWizard(false)}
          onSubmit={async (values, activate) => {
            setBusy(true);
            try {
              const year = new Date().getFullYear();
              const code = `PM-${year}-${String(Date.now()).slice(-4)}`;
              await createPmPlan({
                code,
                name: values.name,
                description: values.description,
                status: activate ? "ACTIVE" : "DRAFT",
                assetId: values.assetId || undefined,
                vehicleId: values.vehicleId || undefined,
                autoCreateWorkOrder: values.autoWo,
                combineMode: values.trigger === "HYBRID" ? "EARLIEST" : "EARLIEST",
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
              write({ refresh: String(Date.now()) });
            } catch (err) {
              toast.error(getApiErrorMessage(err, "Could not save the plan"));
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function CreatePlanWizard({
  busy,
  onClose,
  onSubmit
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (
    values: {
      name: string;
      description: string;
      assetId: string;
      vehicleId: string;
      trigger: string;
      intervalDays: number;
      intervalValue: number;
      unit: string;
      autoWo: boolean;
    },
    activate: boolean
  ) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assetId, setAssetId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [assetLabel, setAssetLabel] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [trigger, setTrigger] = useState("CALENDAR");
  const [intervalDays, setIntervalDays] = useState("30");
  const [intervalValue, setIntervalValue] = useState("250");
  const [unit, setUnit] = useState("hrs");
  const [autoWo, setAutoWo] = useState(true);

  const parsePositiveInterval = (raw: string, label: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) {
      toast.error(`Enter a ${label}.`);
      return null;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(`${label} must be greater than 0.`);
      return null;
    }
    return value;
  };

  const validateStep = (currentStep: number, activate: boolean) => {
    if (currentStep === 1 && name.trim().length < 3) {
      toast.error("Enter a plan name.");
      return false;
    }
    if (currentStep === 2 && activate && !assetId.trim() && !vehicleId.trim()) {
      toast.error("Select an asset or vehicle before activating the plan.");
      return false;
    }
    if (currentStep === 3) {
      if (trigger !== "METER") {
        if (parsePositiveInterval(intervalDays, "calendar interval (days)") == null) return false;
      }
      if (trigger !== "CALENDAR") {
        if (parsePositiveInterval(intervalValue, "meter interval") == null) return false;
      }
    }
    return true;
  };

  const submit = (event: FormEvent, activate: boolean) => {
    event.preventDefault();
    if (!validateStep(1, activate)) return;
    if (activate && !assetId.trim() && !vehicleId.trim()) {
      toast.error("Select an asset or vehicle before activating the plan.");
      return;
    }

    let parsedIntervalDays = 0;
    let parsedIntervalValue = 0;
    if (trigger !== "METER") {
      const days = parsePositiveInterval(intervalDays, "calendar interval (days)");
      if (days == null) return;
      parsedIntervalDays = days;
    }
    if (trigger !== "CALENDAR") {
      const meter = parsePositiveInterval(intervalValue, "meter interval");
      if (meter == null) return;
      parsedIntervalValue = meter;
    }

    void onSubmit(
      {
        name: name.trim(),
        description,
        assetId: assetId.trim(),
        vehicleId: vehicleId.trim(),
        trigger,
        intervalDays: parsedIntervalDays,
        intervalValue: parsedIntervalValue,
        unit,
        autoWo
      },
      activate
    );
  };

  return (
    <form className="rounded-xl border border-slate-200 bg-white p-4" onSubmit={(event) => submit(event, false)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Create PM Plan</h2>
        <button type="button" className="min-h-11 px-2" onClick={onClose}>Close</button>
      </div>
      <p className="mt-1 text-sm text-slate-500">Step {step} of 4</p>
      {step === 1 ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Plan name
            <input className="mt-1 min-h-11 w-full rounded-lg border px-3" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="block text-sm">
            Description
            <textarea className="mt-1 w-full rounded-lg border px-3 py-2" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-600">
            Assign the asset or vehicle this plan maintains. Required before activation; drafts may be saved without a target.
          </p>
          <div className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Asset</span>
            <EntityPicker
              endpoint="/assets"
              searchParam="search"
              pageSizeParam="limit"
              pageSize={20}
              extraParams={{ selectableForWork: true, status: "ACTIVE" }}
              value={assetId || null}
              displayField="name"
              secondaryField="assetTag"
              initialDisplay={assetLabel}
              placeholder="Search asset by name or tag..."
              onChange={(id, entity) => {
                setAssetId(id ?? "");
                if (id) setVehicleId("");
                const tag = entity ? String(entity.assetTag ?? "") : "";
                const assetName = entity ? String(entity.name ?? "") : "";
                setAssetLabel([tag, assetName].filter(Boolean).join(" — ") || assetName);
                if (id) setVehicleLabel("");
              }}
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Vehicle</span>
            <EntityPicker
              endpoint="/vehicles"
              value={vehicleId || null}
              displayField="registrationNo"
              secondaryField="vehicleModel"
              initialDisplay={vehicleLabel}
              placeholder="Search vehicle by registration..."
              onChange={(id, entity) => {
                setVehicleId(id ?? "");
                if (id) setAssetId("");
                setVehicleLabel(entity ? String(entity.registrationNo ?? "") : "");
                if (id) {
                  setAssetId("");
                  setAssetLabel("");
                }
              }}
            />
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Trigger
            <select className="mt-1 min-h-11 w-full rounded-lg border px-2" value={trigger} onChange={(event) => setTrigger(event.target.value)}>
              <option value="CALENDAR">Calendar</option>
              <option value="METER">Meter</option>
              <option value="HYBRID">Calendar or meter, whichever comes first</option>
            </select>
          </label>
          {trigger !== "METER" ? (
            <label className="block text-sm">
              Calendar interval (days)
              <input
                type="number"
                min={1}
                required
                className="mt-1 min-h-11 w-full rounded-lg border px-3"
                value={intervalDays}
                onChange={(event) => setIntervalDays(event.target.value)}
              />
            </label>
          ) : null}
          {trigger !== "CALENDAR" ? (
            <label className="block text-sm">
              Meter interval
              <input
                type="number"
                min={1}
                required
                className="mt-1 min-h-11 w-full rounded-lg border px-3"
                value={intervalValue}
                onChange={(event) => setIntervalValue(event.target.value)}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      {step === 4 ? (
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={autoWo} onChange={(event) => setAutoWo(event.target.checked)} />
            Auto-generate work order when due
          </label>
          <p>Review: {name || "Untitled"} · {trigger} · {autoWo ? "Auto WO on" : "Auto WO off"}</p>
          <p className="text-slate-500">Draft plans do not generate work orders until they are activated.</p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {step > 1 ? (
          <button type="button" className="min-h-11 rounded-lg border px-3" onClick={() => setStep((current) => current - 1)}>
            Back
          </button>
        ) : null}
        {step < 4 ? (
          <button
            type="button"
            className="min-h-11 rounded-lg bg-slate-900 px-3 text-white"
            onClick={() => {
              if (!validateStep(step, false)) return;
              setStep((current) => current + 1);
            }}
          >
            Continue
          </button>
        ) : (
          <>
            <button type="submit" className="min-h-11 rounded-lg border px-3" disabled={busy}>
              Save Draft
            </button>
            <button type="button" className="min-h-11 rounded-lg bg-brand-600 px-3 text-white" disabled={busy} onClick={(event) => submit(event, true)}>
              Activate Plan
            </button>
          </>
        )}
      </div>
    </form>
  );
}
