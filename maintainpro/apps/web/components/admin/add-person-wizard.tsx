"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
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

type WizardState = {
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
  dailyCapacityHours: string;
  shift: string;
  canReceiveWorkOrders: boolean;
  availabilityStatus: string;
  canLogin: boolean;
  roleId: string;
  branchScope: string;
  inviteMethod: "INVITE_EMAIL" | "TEMP_PASSWORD" | "COPY_LINK";
};

const INITIAL: WizardState = {
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
  dailyCapacityHours: "8",
  shift: "",
  canReceiveWorkOrders: true,
  availabilityStatus: "AVAILABLE",
  canLogin: false,
  roleId: "",
  branchScope: "",
  inviteMethod: "INVITE_EMAIL"
};

export function AddPersonWizard() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardState>(INITIAL);
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Array<{ id: string; name: string }> }>("/roles");
      return response.data.data ?? [];
    },
    enabled: isAdmin
  });

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (form.canLogin && !form.roleId) list.push("Login selected but role missing");
    if (form.isTechnician && !form.skills.trim()) list.push("Technician selected but skills missing");
    if (!form.active && form.canLogin) list.push("Inactive employee cannot login");
    if (form.canLogin && !form.email.trim()) list.push("Email required for login");
    if (form.canLogin && !form.branchName.trim()) list.push("Branch is required");
    return list;
  }, [form]);

  const createMutation = useMutation({
    mutationFn: (payload: CreatePersonPayload) => createPerson(payload),
    onSuccess: (result) => {
      if (result.temporaryPassword) setOneTimeSecret(result.temporaryPassword);
      if (result.inviteLink) setOneTimeSecret(result.inviteLink);
      if (!result.emailProviderConfigured && form.inviteMethod === "INVITE_EMAIL") {
        toast.message("Email provider is not configured. Please use Copy Invite Link or Temporary Password.");
      }
      toast.success("Person created successfully");
      setStep(5);
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
    dailyCapacityHours: Number(form.dailyCapacityHours) || 8,
    shift: form.shift.trim() || undefined,
    canReceiveWorkOrders: form.canReceiveWorkOrders,
    availabilityStatus: form.availabilityStatus,
    canLogin: form.canLogin,
    roleId: form.canLogin ? form.roleId : undefined,
    branchScope: form.branchScope.trim() || form.branchName.trim() || undefined,
    inviteMethod: form.canLogin ? form.inviteMethod : undefined
  };

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageBreadcrumbs />
        <PermissionState title="Admin access required" description="Only admins can onboard people." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageBreadcrumbs />
      <header>
        <Link href={"/admin/people" as Route} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" />
          Back to People
        </Link>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Add Person</h2>
        <p className="mt-1 text-sm text-slate-500">Step {step} of 5</p>
      </header>

      {step === 1 ? (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h3 className="font-semibold">Basic Info</h3>
          <input placeholder="Employee No (optional)" value={form.employeeNo} onChange={(e) => setForm({ ...form, employeeNo: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
          <input placeholder="Full Name *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
          <input placeholder="Mobile" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
          <input placeholder="Branch *" value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
          <DepartmentSelect value={form.departmentId} onChange={(departmentId) => setForm({ ...form, departmentId })} />
          <select value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="w-full rounded border px-3 py-2 text-sm">
            {ASSIGNABLE_WORKFORCE_DESIGNATIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h3 className="font-semibold">Work Profile</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isTechnician} onChange={(e) => setForm({ ...form, isTechnician: e.target.checked })} /> Technician</label>
          {form.isTechnician ? (
            <>
              <input placeholder="Skills (comma separated)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
              <input placeholder="Work categories" value={form.workCategories} onChange={(e) => setForm({ ...form, workCategories: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
              <input placeholder="Daily capacity hours" value={form.dailyCapacityHours} onChange={(e) => setForm({ ...form, dailyCapacityHours: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
              <input placeholder="Shift" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.canReceiveWorkOrders} onChange={(e) => setForm({ ...form, canReceiveWorkOrders: e.target.checked })} /> Can receive work orders</label>
              <select value={form.availabilityStatus} onChange={(e) => setForm({ ...form, availabilityStatus: e.target.value })} className="w-full rounded border px-3 py-2 text-sm">
                <option value="AVAILABLE">Available</option>
                <option value="ON_LEAVE">On leave</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </>
          ) : null}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h3 className="font-semibold">Login Access</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.canLogin} onChange={(e) => setForm({ ...form, canLogin: e.target.checked })} /> Can login to the system</label>
          {form.canLogin ? (
            <>
              <input placeholder="Login email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
              <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className="w-full rounded border px-3 py-2 text-sm">
                <option value="">Select role</option>
                {(rolesQuery.data ?? []).map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              <input placeholder="Branch scope" value={form.branchScope} onChange={(e) => setForm({ ...form, branchScope: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
              <select value={form.inviteMethod} onChange={(e) => setForm({ ...form, inviteMethod: e.target.value as WizardState["inviteMethod"] })} className="w-full rounded border px-3 py-2 text-sm">
                <option value="INVITE_EMAIL">Send Invite Email</option>
                <option value="TEMP_PASSWORD">Generate Temporary Password</option>
                <option value="COPY_LINK">Copy Invite Link fallback</option>
              </select>
            </>
          ) : null}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-3 rounded-xl border bg-white p-5 text-sm">
          <h3 className="font-semibold">Review</h3>
          <p><strong>Name:</strong> {form.fullName}</p>
          <p><strong>Designation:</strong> {form.designation}</p>
          <p><strong>Branch:</strong> {form.branchName || "—"}</p>
          <p><strong>Technician:</strong> {form.isTechnician ? "Yes" : "No"}</p>
          <p><strong>Login:</strong> {form.canLogin ? "Yes" : "No"}</p>
          {form.canLogin ? <p><strong>Invite method:</strong> {form.inviteMethod}</p> : null}
          {warnings.length ? (
            <ul className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
              {warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" /> Person created</div>
          {oneTimeSecret ? (
            <div>
              <p className="font-medium">One-time password or invite link</p>
              <p className="mt-1 break-all font-mono text-xs">{oneTimeSecret}</p>
            </div>
          ) : null}
          <Link href={"/admin/people" as Route} className="inline-block underline">Return to People list</Link>
        </section>
      ) : null}

      {step < 5 ? (
        <div className="flex justify-between">
          <button type="button" disabled={step === 1} className="rounded border px-4 py-2 text-sm disabled:opacity-40" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          {step < 4 ? (
            <button type="button" className="inline-flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm text-white" onClick={() => setStep((s) => s + 1)}>
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={createMutation.isPending || warnings.length > 0 || !form.fullName.trim()}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              onClick={() => createMutation.mutate(payload)}
            >
              {createMutation.isPending ? "Creating…" : "Create Person"}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
