"use client";

import { Filter, Layers3, List, Plus, Search, Trash2 } from "lucide-react";

import { toTitleCase } from "./helpers";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type TechnicianOption,
  type WorkOrderFilters,
  type WorkOrderStatus,
  type WorkOrderViewMode
} from "./types";

type WorkOrderFiltersBarProps = {
  filters: WorkOrderFilters;
  technicians: TechnicianOption[];
  view: WorkOrderViewMode;
  selectionCount: number;
  bulkLoading: boolean;
  onChange: (patch: Partial<WorkOrderFilters>) => void;
  onReset: () => void;
  onCreate: () => void;
  onViewChange: (view: WorkOrderViewMode) => void;
  onBulkStatusChange: (status: WorkOrderStatus) => void;
  onBulkDelete: () => void;
};

export function WorkOrderFiltersBar({
  filters,
  technicians,
  view,
  selectionCount,
  bulkLoading,
  onChange,
  onReset,
  onCreate,
  onViewChange,
  onBulkStatusChange,
  onBulkDelete
}: WorkOrderFiltersBarProps) {
  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Work Orders</h2>
          <p className="mt-1 text-sm text-slate-500">Production workflow for corrective and preventive tasks.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
            <button
              type="button"
              onClick={() => onViewChange("kanban")}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition ${
                view === "kanban" ? "bg-brand-100 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Layers3 size={14} /> Kanban
            </button>
            <button
              type="button"
              onClick={() => onViewChange("list")}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition ${
                view === "list" ? "bg-brand-100 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <List size={14} /> List
            </button>
          </div>

          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Create Work Order
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Search by title or WO number"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          />
        </label>

        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => onChange({ status: event.target.value as WorkOrderFilters["status"] })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          >
            <option value="ALL">All Statuses</option>
            {WORK_ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {toTitleCase(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Priority</span>
          <select
            value={filters.priority}
            onChange={(event) => onChange({ priority: event.target.value as WorkOrderFilters["priority"] })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          >
            <option value="ALL">All Priorities</option>
            {WORK_ORDER_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {toTitleCase(priority)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Technician</span>
          <select
            value={filters.technicianId}
            onChange={(event) => onChange({ technicianId: event.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          >
            <option value="ALL">All Technicians</option>
            <option value="UNASSIGNED">Unassigned</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Due Date From</span>
          <input
            type="date"
            value={filters.dueDateFrom}
            onChange={(event) => onChange({ dueDateFrom: event.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          />
        </label>

        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Due Date To</span>
          <input
            type="date"
            value={filters.dueDateTo}
            onChange={(event) => onChange({ dueDateTo: event.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          />
        </label>

        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Sort By</span>
          <select
            value={filters.sortBy}
            onChange={(event) => onChange({ sortBy: event.target.value as WorkOrderFilters["sortBy"] })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          >
            <option value="createdAt">Created Date</option>
            <option value="woNumber">WO Number</option>
            <option value="title">Title</option>
            <option value="asset">Asset</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="technician">Technician</option>
            <option value="dueDate">Due Date</option>
          </select>
        </label>

        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Direction</span>
          <select
            value={filters.sortDirection}
            onChange={(event) => onChange({ sortDirection: event.target.value as WorkOrderFilters["sortDirection"] })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Filter size={14} /> Reset Filters
        </button>

        {selectionCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">{selectionCount} selected</span>
            <select
              disabled={bulkLoading}
              defaultValue=""
              onChange={(event) => {
                const status = event.target.value as WorkOrderStatus;
                if (!status) {
                  return;
                }
                onBulkStatusChange(status);
                event.currentTarget.value = "";
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
            >
              <option value="">Bulk Status</option>
              {WORK_ORDER_STATUSES.filter((status) => status !== "COMPLETED").map((status) => (
                <option key={status} value={status}>
                  {toTitleCase(status)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onBulkDelete}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              <Trash2 size={12} /> Delete Selected
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
