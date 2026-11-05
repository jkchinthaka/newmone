"use client";

import { MasterListChips } from "@/components/ui/master-list-input";
import { PERSON_INVITE_METHOD_LABELS, personLoginIssues, type PersonInviteMethod } from "@/lib/person-login";
import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { DepartmentSelect } from "@/components/departments/department-select";
import { PermissionState } from "@/components/ui/page-state";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { createPerson, type CreatePersonPayload } from "@/lib/people-api";
import { ASSIGNABLE_WORKFORCE_DESIGNATIONS } from "@/lib/workforce-designations";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";
import { visibleLoginRoles } from "@/lib/visible-login-roles";

type PersonForm = {
  employeeNo: string;
  fullName: string;
  phone: string;
  email: string;
  branchName: string;
  departmentId: string | null;
  designation: string;
  active: boolean;
  isTechnician: boolean;
  skills: string;
  workCategories: string;
  shift: string;
  canReceiveWorkOrders: boolean;
  availabilityStatus: string;
  canLogin: boolean;
  roleId: string;
  branchScope: string;
  inviteMethod: PersonInviteMethod;
  initialPassword: string;
  confirmPassword: string;
};

const INITIAL: PersonForm = {
  employeeNo: "",
  fullName: "",
  phone: "",
  email: "",
  branchName: "",
  departmentId: null,
  designation: "TECHNICIAN",
  active: true,
  isTechnician: true,
  skills: "",
  workCategories: "",
  shift: "",
  canReceiveWorkOrders: true,
  availabilityStatus: "AVAILABLE",
  canLogin: false,
  roleId: "",
  branchScope: "",
  inviteMethod: "SET_PASSWORD",
  initialPassword: "",
  confirmPassword: ""
};

export function AddPersonWizard() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const [created, setCreated] = useState(false);
  const [form, setForm] = useState<PersonForm>(INITIAL);
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Array<{ id: string; name: string }> }>("/roles");
      return response.data.data ?? [];
    },
    enabled: isAdmin
  });

  const loginIssues = useMemo(() => personLoginIssues(form), [form]);
  const createMutation = useMutation({
    mutationFn: (payload: CreatePersonPayload) => createPerson(payload),
    onSuccess: (result) => {
      // Never keep the admin-typed password in memory after it has been sent.
      setForm((current) => ({ ...current, initialPassword: "", confirmPassword: "" }));
      if (result.temporaryPassword) setOneTimeSecret(result.temporaryPassword);
      if (result.inviteLink) setOneTimeSecret(result.inviteLink);
      if (!result.emailProviderConfigured && form.inviteMethod === "INVITE_EMAIL") {
        toast.message("Email provider is not configured. Please use Copy Invite Link or Temporary Password.");
      }
      toast.success("Person created successfully");
      setCreated(true);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not create person"))
  });

  const payload: CreatePersonPayload = {
    employeeNo: form.employeeNo.trim() || undefined,
    fullName: form.fullName.trim(),
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    branchName: form.branchName.trim() || undefined,
    departmentId: form.departmentId ?? undefined,
    designation: form.designation,
    active: form.active,
    isTechnician: form.isTechnician,
    skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
    workCategories: form.workCategories.split(",").map((s) => s.trim()).filter(Boolean),
    shift: form.shift.trim() || undefined,
    canReceiveWorkOrders: form.canReceiveWorkOrders,
    availabilityStatus: form.availabilityStatus,
    canLogin: form.canLogin,
    roleId: form.canLogin ? form.roleId : undefined,
    branchScope: form.branchScope.trim() || form.branchName.trim() || undefined,
    inviteMethod: form.canLogin ? form.inviteMethod : undefined,
    initialPassword: form.canLogin && form.inviteMethod === "SET_PASSWORD" ? form.initialPassword : undefined
  };

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageBreadcrumbs />
        <PermissionState title="Admin access required" description="Only admins can onboard people." />
      </div>
    );
  }

  const input = "h-10 w-full rounded-md border border-slate-300 px-3 text-sm";
  const label = "mb-1 block text-sm font-medium text-slate-700";
  const canSave = !createMutation.isPending && loginIssues.length === 0 && form.fullName.trim().length > 0;

  if (created) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageBreadcrumbs />
        <section className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" /> Person created</div>
          {form.canLogin && form.inviteMethod === "SET_PASSWORD" ? (
            <p>They can sign in with the password you set. They must change it the first time they sign in.</p>
          ) : null}
          {oneTimeSecret ? (
            <div>
              <p className="font-medium">One-time password or invite link</p>
              <p className="mt-1 break-all font-mono text-xs">{oneTimeSecret}</p>
            </div>
          ) : null}
          <Link href={"/admin/people" as Route} className="inline-block font-medium underline">Back to people</Link>
        </section>
      </div>
    );
  }

  return (
    <form
      className="mx-auto max-w-2xl space-y-5 pb-24"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) createMutation.mutate(payload);
      }}
    >
      <PageBreadcrumbs />
      <header>
        <Link href={"/admin/people" as Route} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" />
          Back to people
        </Link>
        <h2 className="mt-2 page-title">Add person</h2>
        <p className="mt-1 text-sm text-slate-500">Only the name is required. Add a login only if this person will use the app.</p>
      </header>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Person</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="person-name">Full name *</label>
            <input id="person-name" required autoFocus value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="person-no">Employee no</label>
            <input id="person-no" value={form.employeeNo} onChange={(e) => setForm({ ...form, employeeNo: e.target.value })} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="person-phone">Mobile</label>
            <input id="person-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="person-branch">Branch</label>
            <input id="person-branch" value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} className={input} />
          </div>
          <div>
            <span className={label}>Department</span>
            <DepartmentSelect value={form.departmentId} onChange={(departmentId) => setForm({ ...form, departmentId })} />
          </div>
          <div>
            <label className={label} htmlFor="person-designation">Designation</label>
            <select id="person-designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className={input}>
              {ASSIGNABLE_WORKFORCE_DESIGNATIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <label className="flex items-center gap-2 font-semibold text-slate-900"><input type="checkbox" checked={form.isTechnician} onChange={(e) => setForm({ ...form, isTechnician: e.target.checked })} /> Technician (can be given jobs)</label>
        {form.isTechnician ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label} htmlFor="person-skills">Skills (comma separated)</label>
              <input id="person-skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className={input} />
              <MasterListChips kind="skill" value={form.skills} onValueChange={(v) => setForm({ ...form, skills: v })} />
            </div>
            <div>
              <label className={label} htmlFor="person-categories">Work categories</label>
              <input id="person-categories" value={form.workCategories} onChange={(e) => setForm({ ...form, workCategories: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="person-shift">Shift</label>
              <input id="person-shift" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="person-availability">Availability</label>
              <select id="person-availability" value={form.availabilityStatus} onChange={(e) => setForm({ ...form, availabilityStatus: e.target.value })} className={input}>
                <option value="AVAILABLE">Available</option>
                <option value="ON_LEAVE">On leave</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={form.canReceiveWorkOrders} onChange={(e) => setForm({ ...form, canReceiveWorkOrders: e.target.checked })} /> Can receive jobs</label>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <label className="flex items-center gap-2 font-semibold text-slate-900"><input type="checkbox" checked={form.canLogin} onChange={(e) => setForm({ ...form, canLogin: e.target.checked })} /> Can log in to the app</label>
        {form.canLogin ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="person-email">Login email *</label>
              <input id="person-email" type="email" required autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="person-role">Role *</label>
              <select id="person-role" required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className={input}>
                <option value="">Select role</option>
                {visibleLoginRoles(rolesQuery.data ?? [], form.roleId).map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="person-invite-method">How will they get their first password?</label>
              <select id="person-invite-method" value={form.inviteMethod} onChange={(e) => setForm({ ...form, inviteMethod: e.target.value as PersonInviteMethod, initialPassword: "", confirmPassword: "" })} className={input}>
                {(Object.keys(PERSON_INVITE_METHOD_LABELS) as PersonInviteMethod[]).map((method) => (
                  <option key={method} value={method}>{PERSON_INVITE_METHOD_LABELS[method]}</option>
                ))}
              </select>
            </div>
            {form.inviteMethod === "SET_PASSWORD" ? (
              <>
                <div>
                  <label className={label} htmlFor="person-password">Password *</label>
                  <input id="person-password" type="password" required autoComplete="new-password" value={form.initialPassword} onChange={(e) => setForm({ ...form, initialPassword: e.target.value })} className={input} />
                </div>
                <div>
                  <label className={label} htmlFor="person-password2">Confirm password *</label>
                  <input id="person-password2" type="password" required autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className={input} />
                </div>
                <p className="text-xs text-slate-500 sm:col-span-2">At least 8 characters with an uppercase letter, a number and a symbol. They must change it the first time they sign in.</p>
              </>
            ) : null}
            {loginIssues.length ? (
              <ul className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2" aria-live="polite">
                {loginIssues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No login: this person can be given jobs but cannot open the app.</p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-end gap-3">
          <Link href={"/admin/people" as Route} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</Link>
          <button type="submit" disabled={!canSave} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
            {createMutation.isPending ? "Saving…" : "Create person"}
          </button>
        </div>
      </div>
    </form>
  );
}
