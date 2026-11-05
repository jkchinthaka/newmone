"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { EntityPicker } from "@/components/ui/entity-picker";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  createAdminUser,
  updateAdminUser,
  type AdminUserDetail,
  type CreateAdminUserPayload,
  type UpdateAdminUserPayload
} from "@/lib/admin-users-api";
import { fetchAdminTenantOverviewList } from "@/lib/admin-tenants-api";
import type { AdminRoleReviewRow } from "@/lib/admin-roles";
import { formatRoleLabel } from "@/lib/admin-roles";
import { visibleLoginRoles } from "@/lib/visible-login-roles";
import { PermissionOverridesCard } from "./permission-overrides-card";

export interface AdminUserFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  roles: AdminRoleReviewRow[];
  /** Present when editing; absent when creating. */
  user?: (AdminUserDetail & { displayName?: string }) | null;
  showPermissionOverrides?: boolean;
  permissionOptions?: { key: string; description?: string | null }[];
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: string;
  tenantId: string;
  departmentId: string | null;
  departmentDisplay: string;
  siteId: string | null;
  siteDisplay: string;
  employeeId: string | null;
  employeeDisplay: string;
  designation: string;
  password: string;
}

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  roleId: "",
  tenantId: "",
  departmentId: null,
  departmentDisplay: "",
  siteId: null,
  siteDisplay: "",
  employeeId: null,
  employeeDisplay: "",
  designation: "",
  password: ""
};

export function AdminUserFormDialog({
  open,
  onClose,
  onSaved,
  roles,
  user,
  showPermissionOverrides = false,
  permissionOptions = []
}: AdminUserFormDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const isEditing = Boolean(user);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useFocusTrap(open, panelRef, { onEscape: submitting ? undefined : onClose });

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setMoreOpen(false);
    setForm(
      user
        ? {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone ?? "",
            roleId: user.role.id,
            tenantId: user.tenantId ?? "",
            departmentId: user.departmentId ?? null,
            departmentDisplay: "",
            siteId: user.siteId ?? null,
            siteDisplay: "",
            employeeId: null,
            employeeDisplay: "",
            designation: user.designation ?? "",
            password: ""
          }
        : EMPTY_FORM
    );
    fetchAdminTenantOverviewList()
      .then((rows) => {
        const mapped = rows.map((t) => ({ id: t.id, name: t.name, isActive: t.isActive }));
        setTenants(mapped);
        // A new user belongs to the only active company by default, so they can see its data.
        const active = mapped.filter((t) => t.isActive);
        if (!user && active.length === 1) {
          setForm((c) => (c.tenantId ? c : { ...c, tenantId: active[0].id }));
        }
      })
      .catch(() => setTenants([]));
  }, [open, user]);

  if (!open) {
    return null;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "First name is required";
    if (!form.lastName.trim()) next.lastName = "Last name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address";
    if (!form.roleId) next.roleId = "Select a role";
    if (!isEditing && form.password && !/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(form.password)) {
      next.password = "At least 8 characters, one uppercase letter, one number, and one special character";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isEditing && user) {
        const payload: UpdateAdminUserPayload = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          roleId: form.roleId,
          tenantId: form.tenantId || undefined,
          departmentId: form.departmentId ?? undefined,
          siteId: form.siteId ?? undefined,
          employeeId: form.employeeId ?? undefined,
          designation: form.designation.trim() || undefined
        };
        await updateAdminUser(user.id, payload);
        toast.success(`${form.firstName} ${form.lastName} updated`);
      } else {
        const payload: CreateAdminUserPayload = {
          email: form.email.trim().toLowerCase(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          roleId: form.roleId,
          phone: form.phone.trim() || undefined,
          tenantId: form.tenantId || undefined,
          departmentId: form.departmentId ?? undefined,
          siteId: form.siteId ?? undefined,
          employeeId: form.employeeId ?? undefined,
          designation: form.designation.trim() || undefined,
          password: form.password || undefined
        };
        const created = await createAdminUser(payload);
        if (created.temporaryPassword) {
          toast.success(`User created. Temporary password: ${created.temporaryPassword}`, { duration: 30000 });
        } else {
          toast.success(`${form.firstName} ${form.lastName} created`);
        }
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
      <button type="button" aria-label="Close dialog backdrop" className="absolute inset-0" onClick={submitting ? undefined : onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {isEditing ? "Edit User" : "Add User"}
          </h2>
          <button type="button" onClick={submitting ? undefined : onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {!isEditing ? (
              <div className="space-y-1 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-3 text-sm text-slate-700 sm:col-span-2">
                <span className="block font-medium">Start from an employee (optional)</span>
                <EntityPicker
                  endpoint="/workforce/employees"
                  placeholder="Search employees to fill name, email and phone…"
                  value={form.employeeId}
                  initialDisplay={form.employeeDisplay || undefined}
                  displayField="fullName"
                  secondaryField="employeeNo"
                  extraParams={{ active: true }}
                  onChange={(id, entity: any) =>
                    setForm((c) => ({
                      ...c,
                      employeeId: id,
                      employeeDisplay: entity ? `${entity.employeeNo ? entity.employeeNo + " — " : ""}${entity.fullName}` : "",
                      ...(entity && !c.firstName && !c.lastName
                        ? { firstName: String(entity.fullName).split(" ")[0] ?? "", lastName: String(entity.fullName).split(" ").slice(1).join(" ") }
                        : {}),
                      ...(entity && !c.email && entity.email ? { email: entity.email } : {}),
                      ...(entity && !c.phone && entity.phone ? { phone: entity.phone } : {}),
                      ...(entity && !c.designation && entity.designation ? { designation: entity.designation } : {})
                    }))
                  }
                />
                <span className="block text-xs text-slate-500">Picking an employee fills in the name, email and phone, and gives them a login.</span>
              </div>
            ) : null}
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 sm:col-span-2">Login details</p>
            <Field label="First name *" error={errors.firstName}>
              <input value={form.firstName} onChange={(e) => setForm((c) => ({ ...c, firstName: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4" />
            </Field>
            <Field label="Last name *" error={errors.lastName}>
              <input value={form.lastName} onChange={(e) => setForm((c) => ({ ...c, lastName: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4" />
            </Field>
            <Field label="Email *" error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="name@company.com" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4" />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} placeholder="07X XXX XXXX" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4" />
            </Field>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 sm:col-span-2">Access</p>
            <Field label="Role *" error={errors.roleId}>
              <select value={form.roleId} onChange={(e) => setForm((c) => ({ ...c, roleId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4">
                <option value="">Select role…</option>
                {visibleLoginRoles(roles, form.roleId).map((role) => (
                  <option key={role.id} value={role.id}>
                    {formatRoleLabel(role.name)}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-slate-500">The role decides which pages they can see.</span>
            </Field>
            {tenants.filter((t) => t.isActive).length > 1 ? (
            <Field label="Company">
              <select
                value={form.tenantId}
                onChange={(e) => setForm((c) => ({ ...c, tenantId: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
              >
                <option value="">No tenant (platform-level)</option>
                {tenants.filter((t) => t.isActive).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            ) : null}
            <div className="space-y-1 text-sm text-slate-700">
              <span className="block font-medium">Department</span>
              <EntityPicker
                endpoint="/departments"
                placeholder="Search departments…"
                value={form.departmentId}
                initialDisplay={form.departmentDisplay || undefined}
                displayField="name"
                secondaryField="code"
                onChange={(id, entity: any) =>
                  setForm((c) => ({ ...c, departmentId: id, departmentDisplay: entity ? `${entity.code} — ${entity.name}` : "" }))
                }
              />
            </div>
            <div className="space-y-1 text-sm text-slate-700">
              <span className="block font-medium">Location</span>
              <EntityPicker
                endpoint="/organization/sites"
                placeholder="Search locations…"
                value={form.siteId}
                initialDisplay={form.siteDisplay || undefined}
                displayField="name"
                secondaryField="code"
                onChange={(id, entity: any) => setForm((c) => ({ ...c, siteId: id, siteDisplay: entity ? `${entity.code} — ${entity.name}` : "" }))}
              />
            </div>
            <Field label="Designation">
              <input value={form.designation} onChange={(e) => setForm((c) => ({ ...c, designation: e.target.value }))} placeholder="e.g. Fleet Coordinator" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4" />
            </Field>
            {!isEditing ? (
              <div className="space-y-2 text-sm text-slate-700 sm:col-span-2">
                {moreOpen ? (
                  <Field label="Password" error={errors.password}>
                    <input
                      type="text"
                      value={form.password}
                      onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                      placeholder="8+ characters, one capital, one number, one symbol"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
                    />
                  </Field>
                ) : (
                  <p className="text-xs text-slate-600">
                    A temporary password is generated when you save and shown once.{" "}
                    <button type="button" onClick={() => setMoreOpen(true)} className="font-medium text-brand-700 hover:underline">Set my own password</button>
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </form>

        {showPermissionOverrides && user ? (
          <PermissionOverridesCard permissionOptions={permissionOptions} userId={user.id} />
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            {isEditing ? "Save Changes" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      {children}
      {error ? <span className="block text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}
