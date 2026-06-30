"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, Plus, PowerOff, Users } from "lucide-react";
import { toast } from "sonner";

import { DepartmentSelect } from "@/components/departments/department-select";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { ASSIGNABLE_WORKFORCE_DESIGNATIONS } from "@/lib/workforce-designations";

interface EmployeeRow {
  id: string;
  employeeNo?: string | null;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  branchName?: string | null;
  departmentId?: string | null;
  designation: string;
  skills: string[];
  dailyCapacityHours: number;
  active: boolean;
  canLogin: boolean;
  linkedUserId?: string | null;
  department?: { id: string; name: string; code: string } | null;
  linkedUser?: { id: string; email: string; isActive: boolean; role: { name: string } } | null;
}

interface FormState {
  fullName: string;
  employeeNo: string;
  phone: string;
  email: string;
  branchName: string;
  departmentId: string | null;
  designation: string;
  skills: string;
  dailyCapacityHours: string;
  active: boolean;
  canLogin: boolean;
}

const EMPTY_FORM: FormState = {
  fullName: "",
  employeeNo: "",
  phone: "",
  email: "",
  branchName: "",
  departmentId: null,
  designation: "TECHNICIAN",
  skills: "",
  dailyCapacityHours: "8",
  active: true,
  canLogin: false
};

export default function WorkforceEmployeesPage() {
  const searchParams = useSearchParams();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState(searchParams.get("designation") ?? "");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("active");
  const [showForm, setShowForm] = useState(Boolean(searchParams.get("designation")));

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ data: EmployeeRow[] }>("/workforce/employees", {
        params: {
          q: search.trim() || undefined,
          designation: designationFilter.trim() || undefined,
          active: activeFilter === "all" ? undefined : activeFilter === "active"
        }
      });
      setItems(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load employees."));
    } finally {
      setLoading(false);
    }
  }, [activeFilter, designationFilter, search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const preset = searchParams.get("designation");
    if (preset) {
      setDesignationFilter(preset);
      setForm((current) => ({ ...current, designation: preset }));
      setShowForm(true);
    }
  }, [searchParams]);

  const filteredCount = useMemo(() => items.length, [items]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!form.designation.trim()) {
      toast.error("Designation is required");
      return;
    }
    const capacity = Number(form.dailyCapacityHours);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      toast.error("Daily capacity hours must be greater than 0");
      return;
    }
    if (form.canLogin && !form.email.trim()) {
      toast.error("Email is required when login access is enabled");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        employeeNo: form.employeeNo.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        branchName: form.branchName.trim() || undefined,
        departmentId: form.departmentId ?? undefined,
        designation: form.designation.trim(),
        skills: form.skills
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        dailyCapacityHours: capacity,
        active: form.active,
        canLogin: form.canLogin
      };

      if (editingId) {
        await apiClient.put(`/workforce/employees/${editingId}`, payload);
        toast.success("Employee updated");
        setEditingId(null);
      } else {
        await apiClient.post("/workforce/employees", payload);
        toast.success(`Employee "${form.fullName.trim()}" created`);
      }

      setForm(EMPTY_FORM);
      setShowForm(false);
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save employee."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (row: EmployeeRow) => {
    setEditingId(row.id);
    setShowForm(true);
    setForm({
      fullName: row.fullName,
      employeeNo: row.employeeNo ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      branchName: row.branchName ?? "",
      departmentId: row.departmentId ?? null,
      designation: row.designation,
      skills: row.skills.join(", "),
      dailyCapacityHours: String(row.dailyCapacityHours ?? 8),
      active: row.active,
      canLogin: row.canLogin
    });
  };

  const handleToggleActive = async (row: EmployeeRow) => {
    const nextActive = !row.active;
    const ok = await confirm({
      title: nextActive ? "Activate employee?" : "Deactivate employee?",
      description: nextActive
        ? `${row.fullName} will appear in work order assignment lists.`
        : `${row.fullName} will be hidden from assignment and cannot receive new work orders.`,
      confirmLabel: nextActive ? "Activate" : "Deactivate",
      variant: nextActive ? "default" : "destructive"
    });
    if (!ok) return;

    try {
      await apiClient.put(`/workforce/employees/${row.id}`, { active: nextActive });
      toast.success(nextActive ? "Employee activated" : "Employee deactivated");
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update employee status."));
    }
  };

  return (
    <div className="space-y-6 p-6">
      {confirmDialog}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={"/master-data" as Route}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={14} aria-hidden /> Master Data
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Workforce</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Employees & Technicians</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Maintain workforce members for work order assignment. Login access is optional — employees without
            accounts can still be assigned to jobs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(EMPTY_FORM);
            setShowForm((value) => !value);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={16} aria-hidden /> {showForm ? "Hide form" : "Add employee"}
        </button>
      </header>

      {showForm ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">{editingId ? "Edit employee" : "New employee"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Full name *</span>
              <input
                required
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Employee number</span>
              <input
                value={form.employeeNo}
                onChange={(event) => setForm((current) => ({ ...current, employeeNo: event.target.value }))}
                placeholder="Auto-generated if blank"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Designation *</span>
              <select
                required
                value={form.designation}
                onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {ASSIGNABLE_WORKFORCE_DESIGNATIONS.map((designation) => (
                  <option key={designation} value={designation}>
                    {designation.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Phone</span>
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Email {form.canLogin ? "*" : ""}</span>
              <input
                type="email"
                required={form.canLogin}
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Branch / site</span>
              <input
                value={form.branchName}
                onChange={(event) => setForm((current) => ({ ...current, branchName: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Department</span>
              <DepartmentSelect
                value={form.departmentId}
                label={null}
                onChange={(departmentId) => setForm((current) => ({ ...current, departmentId }))}
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Skills (comma-separated)</span>
              <input
                value={form.skills}
                onChange={(event) => setForm((current) => ({ ...current, skills: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Daily capacity hours *</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                required
                value={form.dailyCapacityHours}
                onChange={(event) => setForm((current) => ({ ...current, dailyCapacityHours: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <div className="flex flex-col gap-2 text-sm sm:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                />
                Active
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.canLogin}
                  onChange={(event) => setForm((current) => ({ ...current, canLogin: event.target.checked }))}
                />
                Can login (creates/links platform user — RBAC via role)
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {editingId ? "Save changes" : "Create employee"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, number, email..."
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={designationFilter}
          onChange={(event) => setDesignationFilter(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All designations</option>
          {ASSIGNABLE_WORKFORCE_DESIGNATIONS.map((designation) => (
            <option key={designation} value={designation}>
              {designation.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as "all" | "active" | "inactive")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All statuses</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2 font-medium text-slate-700">
            <Users size={16} aria-hidden /> {filteredCount} employees
          </span>
        </div>
        {loading ? (
          <p className="inline-flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading employees...
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">No employees match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Branch / Dept</th>
                  <th className="px-4 py-3">Login</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.fullName}</p>
                      <p className="text-xs text-slate-500">{row.employeeNo ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">{row.designation.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {[row.branchName, row.department?.name].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.canLogin ? row.linkedUser?.email ?? row.email ?? "Pending" : "No login"}
                    </td>
                    <td className="px-4 py-3">{row.dailyCapacityHours}h</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(row)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          <Pencil size={12} aria-hidden /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(row)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          <PowerOff size={12} aria-hidden /> {row.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
