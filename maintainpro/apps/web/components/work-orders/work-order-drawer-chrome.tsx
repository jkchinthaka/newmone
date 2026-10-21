"use client";

import { SectionCard, StatusBadge } from "@/components/ui/dashboard";
import {
  displayWorkOrderTitle,
  isWorkOrderDrawerReadOnly,
  VENDOR_REPAIR_STEPS,
  vendorRepairStepper,
  workOrderDrawerStepper,
  workOrderNextStepHint,
  formatDrawerDateTime,
  type WorkOrderDrawerStepper
} from "@/lib/work-order-drawer-display";

import { toTitleCase } from "./helpers";
import { WorkOrderCostBreakdown } from "./work-order-insights";
import type { WorkOrder } from "./types";

export function WorkOrderLockBanner({ status }: { status: string }) {
  if (!isWorkOrderDrawerReadOnly(status)) return null;
  const label = status === "CANCELLED" ? "cancelled" : "closed";
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950" role="status">
      This work order is {label}. Add, edit, remove, and upload actions are locked.
    </div>
  );
}

export function WorkOrderProgress({ status }: { status: string }) {
  const step: WorkOrderDrawerStepper = workOrderDrawerStepper(status);
  if (step.cancelled) {
    return (
      <div className="mt-3">
        <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
          Cancelled
        </span>
      </div>
    );
  }

  return (
    <>
      <p className="mt-3 text-sm font-medium text-slate-800 sm:hidden">
        Step {step.index + 1} of {step.steps.length} · {step.steps[step.index]}
      </p>
      <ol className="mt-3 hidden min-w-0 items-center gap-1 overflow-x-auto text-xs sm:flex" aria-label="Work order progress">
      {step.steps.map((label, index) => {
        const done = index < step.index;
        const current = index === step.index;
        return (
          <li key={label} className="flex shrink-0 items-center gap-1">
            {index > 0 ? (
              <span className={`h-0.5 w-4 shrink-0 sm:w-8 ${done || current ? "bg-brand-600" : "bg-slate-200"}`} aria-hidden />
            ) : null}
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap ${
                current ? "font-semibold text-brand-800" : done ? "text-brand-700" : "text-slate-400"
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  current || done ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600"
                }`}
                aria-hidden
              >
                {index + 1}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
    </>
  );
}

export function VendorRepairProgress({ status }: { status?: string | null }) {
  const step = vendorRepairStepper(status);
  if (step.cancelled) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
        Cancelled
      </span>
    );
  }
  return (
    <ol className="flex min-w-0 items-center gap-1 overflow-x-auto text-xs" aria-label="Vendor repair progress">
      {VENDOR_REPAIR_STEPS.map((label, index) => {
        const current = index === step.index;
        const done = index < step.index;
        return (
          <li key={label} className="flex items-center gap-1">
            {index > 0 ? <span className={`h-0.5 w-4 ${done || current ? "bg-brand-600" : "bg-slate-200"}`} aria-hidden /> : null}
            <span className={current ? "font-semibold text-brand-800" : done ? "text-brand-700" : "text-slate-400"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function money(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(amount);
}

function when(value?: string | null): string | null {
  if (!value) return null;
  return formatDrawerDateTime(value) || value;
}

function person(workOrder: WorkOrder): string | null {
  const name = `${workOrder.createdBy?.firstName ?? ""} ${workOrder.createdBy?.lastName ?? ""}`.trim();
  return name || null;
}

export function WorkOrderOverviewView({
  workOrder,
  description,
  role,
  readOnly,
  onEdit
}: {
  workOrder: WorkOrder;
  description: string;
  role?: string | null;
  readOnly: boolean;
  onEdit: () => void;
}) {
  const estimated = money(workOrder.estimatedCost);
  const actual = money(workOrder.actualCost);
  const hours = workOrder.estimatedHours != null && workOrder.estimatedHours !== "" ? String(workOrder.estimatedHours) : null;
  const actualHours = workOrder.actualHours != null && workOrder.actualHours !== "" ? String(workOrder.actualHours) : null;
  const showCost = Boolean(estimated || actual || hours || actualHours);
  const showSla = Boolean(workOrder.slaDeadline) || workOrder.slaBreached;
  const rows: Array<[string, string]> = [
    ["Type", toTitleCase(workOrder.type)],
    ["Location", workOrder.asset?.name || workOrder.vehicle?.registrationNo || "No asset linked"]
  ];
  if (workOrder.categoryNameSnapshot) rows.splice(1, 0, ["Category", workOrder.categoryNameSnapshot]);
  else if (workOrder.jobDomain) rows.splice(1, 0, ["Category", toTitleCase(workOrder.jobDomain)]);
  const due = when(workOrder.dueDate);
  if (due) rows.push(["Due date", due]);
  const expected = when(workOrder.expectedCompletionDate);
  if (expected) rows.push(["Expected completion", expected]);
  const requestedBy = person(workOrder);
  if (requestedBy) rows.push(["Requested by", requestedBy]);
  if (workOrder.approvalStatus) rows.push(["Approval", toTitleCase(workOrder.approvalStatus)]);

  return (
    <div className="space-y-4">
      <WorkOrderCostBreakdown workOrderId={workOrder.id} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Job details"
          action={
            readOnly ? null : (
              <button type="button" className="btn-quiet" onClick={onEdit}>
                Edit details
              </button>
            )
          }
        >
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
        <SectionCard title="Description">
          <p className="whitespace-pre-wrap text-sm text-slate-800">{description || "No description."}</p>
          {showCost ? (
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {estimated ? (
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <dt className="text-xs text-slate-500">Estimated cost</dt>
                  <dd className="font-semibold text-slate-900">{estimated}</dd>
                </div>
              ) : null}
              {actual ? (
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <dt className="text-xs text-slate-500">Actual cost</dt>
                  <dd className="font-semibold text-slate-900">{actual}</dd>
                </div>
              ) : null}
              {hours ? (
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <dt className="text-xs text-slate-500">Estimated hours</dt>
                  <dd className="font-semibold text-slate-900">{hours}</dd>
                </div>
              ) : null}
              {actualHours ? (
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <dt className="text-xs text-slate-500">Actual hours</dt>
                  <dd className="font-semibold text-slate-900">{actualHours}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {showSla ? (
            <p className="mt-3 text-sm text-slate-700">
              {workOrder.slaDeadline ? `SLA deadline ${when(workOrder.slaDeadline)}` : "SLA"}
              {workOrder.slaBreached ? " · SLA breached" : ""}
            </p>
          ) : null}
        </SectionCard>
      </div>
      <section className="rounded-card border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="text-sm font-semibold text-slate-900">Next step</h2>
        <p className="mt-1 text-sm text-slate-700">{workOrderNextStepHint(workOrder.status, role)}</p>
      </section>
    </div>
  );
}

export function drawerTitle(workOrder: WorkOrder): string {
  return displayWorkOrderTitle(workOrder.title || "Work order");
}

export function DrawerStatusRow({ workOrder }: { workOrder: WorkOrder }) {
  const due = when(workOrder.dueDate);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
      <StatusBadge status={workOrder.status} />
      <StatusBadge
        status={workOrder.priority}
        className={
          workOrder.priority === "HIGH" || workOrder.priority === "CRITICAL" || workOrder.priority === "MEDIUM"
            ? "bg-amber-50 text-amber-800"
            : undefined
        }
      />
      {workOrder.slaBreached ? (
        <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800">
          SLA breached
        </span>
      ) : null}
      <span className="min-w-0 break-words">
        {workOrder.asset?.name || workOrder.vehicle?.registrationNo || "No asset linked"}
        {workOrder.asset?.assetTag ? ` · ${workOrder.asset.assetTag}` : ""}
      </span>
      {due ? <span>Due {due}</span> : null}
    </div>
  );
}

export function TabCount({ count }: { count?: number }) {
  if (typeof count !== "number" || count <= 0) return null;
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-700">
      {count}
    </span>
  );
}
