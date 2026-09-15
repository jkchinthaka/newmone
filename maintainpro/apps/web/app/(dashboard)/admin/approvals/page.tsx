"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { useCurrentUser } from "@/lib/use-current-user";
import { extractRoleName } from "@/lib/role-redirect";
import {
  createApprovalRule,
  deactivateApprovalRule,
  listApprovalRules,
  previewApprovalRule,
  simulateApprovalRule,
  type ApprovalRule
} from "@/lib/approvals-api";

const PROCESS_TYPES = [
  "CRITICAL_WORK_ORDER",
  "HIGH_COST_WORK_ORDER",
  "VENDOR_REPAIR",
  "ASSET_RETIREMENT",
  "WORK_ORDER_REOPEN",
  "CLOSED_RECORD_CORRECTION",
  "GATE_OVERRIDE",
  "COMPLIANCE_EXCEPTION",
  "BUDGET_EXCEPTION"
] as const;

const TRIGGERS = [
  "BEFORE_CREATE",
  "BEFORE_PLAN",
  "BEFORE_START",
  "BEFORE_ASSIGN_VENDOR",
  "BEFORE_REOPEN",
  "BEFORE_CORRECTION",
  "BEFORE_RETIRE",
  "BEFORE_GATE_OVERRIDE",
  "ON_EXCEPTION"
] as const;

export default function AdminApprovalsPage() {
  const user = useCurrentUser();
  const role = extractRoleName(user?.role);
  const allowed = isAdminConsoleRole(role);

  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [simulation, setSimulation] = useState<unknown>(null);

  const [form, setForm] = useState({
    name: "",
    processType: "CRITICAL_WORK_ORDER",
    trigger: "BEFORE_START",
    amountThreshold: "",
    priorityScope: "CRITICAL",
    approverRole: "MANAGER",
    slaHours: "24",
    emergencyOverrideAllowed: false
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRules(await listApprovalRules());
    } catch (err) {
      setError(getApiErrorMessage(err, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed, refresh]);

  const payload = useMemo(
    () => ({
      name: form.name || `${form.processType} rule`,
      processType: form.processType,
      trigger: form.trigger,
      conditions: form.priorityScope
        ? [{ field: "PRIORITY", operator: "EQ", value: form.priorityScope }]
        : [],
      priorityScope: form.priorityScope ? [form.priorityScope] : [],
      amountThreshold: form.amountThreshold ? Number(form.amountThreshold) : undefined,
      amountField: "estimatedCost",
      slaHours: form.slaHours ? Number(form.slaHours) : undefined,
      emergencyOverrideAllowed: form.emergencyOverrideAllowed,
      levels: [{ level: 1, approverRole: form.approverRole }]
    }),
    [form]
  );

  if (!allowed) {
    return (
      <div className="p-6">
        <ErrorState title="Access denied" description="Admin role required for approval matrix." />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Approvals", href: "/admin/approvals" }
        ]}
      />
      <ResponsivePageHeader
        title="Approval Matrix"
        description="Configurable multi-level approval rules. Thresholds stay configurable â€” never hardcoded."
      />

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Create rule</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Name
            <input
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Process
            <select
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              value={form.processType}
              onChange={(e) => setForm((f) => ({ ...f, processType: e.target.value }))}
            >
              {PROCESS_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Trigger
            <select
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              value={form.trigger}
              onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Priority scope
            <input
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              value={form.priorityScope}
              onChange={(e) => setForm((f) => ({ ...f, priorityScope: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Amount threshold
            <input
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              value={form.amountThreshold}
              onChange={(e) => setForm((f) => ({ ...f, amountThreshold: e.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label className="text-sm">
            Approver role
            <input
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              value={form.approverRole}
              onChange={(e) => setForm((f) => ({ ...f, approverRole: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            SLA hours
            <input
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              value={form.slaHours}
              onChange={(e) => setForm((f) => ({ ...f, slaHours: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:mt-6">
            <input
              type="checkbox"
              checked={form.emergencyOverrideAllowed}
              onChange={(e) => setForm((f) => ({ ...f, emergencyOverrideAllowed: e.target.checked }))}
            />
            Allow emergency override (post-review still required)
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-lg border px-4 text-sm"
            onClick={async () => {
              try {
                setPreview(await previewApprovalRule(payload));
              } catch (err) {
                toast.error(getApiErrorMessage(err, "Request failed"));
              }
            }}
          >
            Preview impact
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg border px-4 text-sm"
            onClick={async () => {
              try {
                setSimulation(
                  await simulateApprovalRule({
                    processType: form.processType,
                    trigger: form.trigger,
                    priority: form.priorityScope || undefined,
                    estimatedCost: form.amountThreshold ? Number(form.amountThreshold) : undefined
                  })
                );
              } catch (err) {
                toast.error(getApiErrorMessage(err, "Request failed"));
              }
            }}
          >
            Simulate (no create)
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm text-white"
            onClick={async () => {
              try {
                await createApprovalRule(payload);
                toast.success("Rule created");
                await refresh();
              } catch (err) {
                toast.error(getApiErrorMessage(err, "Request failed"));
              }
            }}
          >
            Create rule
          </button>
        </div>
        {preview ? (
          <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(preview, null, 2)}</pre>
        ) : null}
        {simulation ? (
          <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(simulation, null, 2)}</pre>
        ) : null}
      </section>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading rulesâ€¦
        </div>
      ) : error ? (
        <ErrorState title="Could not load rules" description={error ?? "Error"} onRetry={() => void refresh()} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Process</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{rule.name}</td>
                  <td className="px-3 py-2">{rule.processType}</td>
                  <td className="px-3 py-2">v{rule.version}</td>
                  <td className="px-3 py-2">{rule.isActive ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    {rule.isActive ? (
                      <button
                        type="button"
                        className="text-red-700"
                        onClick={async () => {
                          try {
                            await deactivateApprovalRule(rule.id);
                            toast.success("Deactivated");
                            await refresh();
                          } catch (err) {
                            toast.error(getApiErrorMessage(err, "Request failed"));
                          }
                        }}
                      >
                        Deactivate
                      </button>
                    ) : (
                      "â€”"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

