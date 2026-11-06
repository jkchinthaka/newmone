"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState } from "@/components/ui/page-state";
import { StatusBadge } from "@/components/ui/dashboard/status-badge";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { formatRoleLabel } from "@/lib/admin-roles";
import { useCurrentUser } from "@/lib/use-current-user";
import { extractRoleName } from "@/lib/role-redirect";
import {
  createApprovalRule,
  deactivateApprovalRule,
  listApprovalRules,
  previewApprovalRule,
  simulateApprovalRule,
  versionApprovalRule,
  type ApprovalRule
} from "@/lib/approvals-api";

const PROCESS_LABELS: Record<string, string> = {
  CRITICAL_WORK_ORDER: "Critical job",
  HIGH_COST_WORK_ORDER: "High-cost job",
  VENDOR_REPAIR: "Vendor repair",
  ASSET_RETIREMENT: "Asset retirement",
  WORK_ORDER_REOPEN: "Reopening a job",
  CLOSED_RECORD_CORRECTION: "Correcting a closed record",
  GATE_OVERRIDE: "Gate override",
  COMPLIANCE_EXCEPTION: "Compliance exception",
  BUDGET_EXCEPTION: "Budget exception"
};

const TRIGGER_LABELS: Record<string, string> = {
  BEFORE_CREATE: "Before it is created",
  BEFORE_PLAN: "Before planning",
  BEFORE_START: "Before job starts",
  BEFORE_ASSIGN_VENDOR: "Before a vendor is assigned",
  BEFORE_REOPEN: "Before reopening",
  BEFORE_CORRECTION: "Before a correction",
  BEFORE_RETIRE: "Before retiring",
  BEFORE_GATE_OVERRIDE: "Before a gate override",
  ON_EXCEPTION: "When an exception happens"
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const FALLBACK_APPROVER_ROLES = ["MANAGER", "SUPERVISOR", "ADMIN", "FINANCE"];

type RuleWithGroup = ApprovalRule & { requesterGroupId?: string | null };

type RuleForm = {
  name: string;
  processType: string;
  trigger: string;
  priority: string;
  amountThreshold: string;
  approverRole: string;
  requesterGroupId: string;
  slaHours: string;
  emergencyOverrideAllowed: boolean;
};

const EMPTY_FORM: RuleForm = {
  name: "",
  processType: "CRITICAL_WORK_ORDER",
  trigger: "BEFORE_START",
  priority: "CRITICAL",
  amountThreshold: "",
  approverRole: "MANAGER",
  requesterGroupId: "",
  slaHours: "24",
  emergencyOverrideAllowed: false
};

function formFromRule(rule: RuleWithGroup): RuleForm {
  return {
    name: rule.name,
    processType: rule.processType,
    trigger: rule.trigger,
    priority: rule.priorityScope?.[0] ?? "",
    amountThreshold: rule.amountThreshold != null ? String(rule.amountThreshold) : "",
    approverRole: rule.levels?.[0]?.approverRole ?? "MANAGER",
    requesterGroupId: rule.requesterGroupId ?? "",
    slaHours: rule.slaHours != null ? String(rule.slaHours) : "",
    emergencyOverrideAllowed: rule.emergencyOverrideAllowed
  };
}

function payloadFromForm(form: RuleForm) {
  return {
    name: form.name.trim() || `${PROCESS_LABELS[form.processType] ?? form.processType} rule`,
    processType: form.processType,
    trigger: form.trigger,
    conditions: form.priority ? [{ field: "PRIORITY", operator: "EQ", value: form.priority }] : [],
    priorityScope: form.priority ? [form.priority] : [],
    amountThreshold: form.amountThreshold ? Number(form.amountThreshold) : undefined,
    amountField: "estimatedCost",
    requesterGroupId: form.requesterGroupId || undefined,
    slaHours: form.slaHours ? Number(form.slaHours) : undefined,
    emergencyOverrideAllowed: form.emergencyOverrideAllowed,
    levels: [{ level: 1, approverRole: form.approverRole }]
  };
}

export default function AdminApprovalsPage() {
  const user = useCurrentUser();
  const role = extractRoleName(user?.role);
  const allowed = isAdminConsoleRole(role);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const [rules, setRules] = useState<RuleWithGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ rule: RuleWithGroup | null } | null>(null);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [approverRoles, setApproverRoles] = useState<string[]>(FALLBACK_APPROVER_ROLES);

  useEffect(() => {
    apiClient
      .get<{ data: Array<{ id: string; name: string }> }>("/master-data/requester-groups")
      .then((res) => setGroups(res.data.data ?? []))
      .catch(() => setGroups([]));
    apiClient
      .get<{ data: Array<{ name: string }> }>("/roles")
      .then((res) => {
        const names = Array.from(new Set((res.data.data ?? []).map((r) => r.name))).sort();
        if (names.length) setApproverRoles(names);
      })
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRules((await listApprovalRules()) as RuleWithGroup[]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed, refresh]);

  async function turnOff(rule: RuleWithGroup) {
    const ok = await confirm({
      title: `Turn off "${rule.name}"?`,
      description: "New requests will no longer need this approval. To turn it on again, edit the rule and save it.",
      confirmLabel: "Turn off",
      cancelLabel: "Keep on",
      variant: "destructive"
    });
    if (!ok) return;
    try {
      await deactivateApprovalRule(rule.id);
      toast.success("Rule turned off");
      await refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Request failed"));
    }
  }

  if (!allowed) {
    return (
      <div className="p-6">
        <ErrorState title="Access denied" description="Admin role required for approval rules." />
      </div>
    );
  }

  return (
    <div className="ops-page">
      {confirmDialog}
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Approval rules", href: "/admin/approval-rules" }
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Approval rules</h1>
          <p className="mt-1 text-sm text-slate-500">Who must approve what, and how long they have. Changes apply to new requests.</p>
        </div>
        <button type="button" onClick={() => setEditing({ rule: null })} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          + New rule
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading rules…
        </div>
      ) : error ? (
        <ErrorState title="Could not load rules" description={error ?? "Error"} onRetry={() => void refresh()} />
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-600">
          No approval rules yet. Use <strong>+ New rule</strong> to add the first one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Rule</th>
                <th className="px-4 py-3 font-semibold">Needs approval for</th>
                <th className="px-4 py-3 font-semibold">Approved by</th>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Time limit</th>
                <th className="px-4 py-3 font-semibold">On</th>
                <th className="px-4 py-3 font-semibold"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setEditing({ rule })} className="text-left font-medium text-slate-900 hover:underline">
                      {rule.name}
                    </button>
                    <span className="block text-xs text-slate-500">v{rule.version}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span>{PROCESS_LABELS[rule.processType] ?? rule.processType}</span>
                    {rule.priorityScope?.length ? (
                      <span className="ml-2 inline-block align-middle">
                        <StatusBadge status={rule.priorityScope[0]!} label={formatRoleLabel(rule.priorityScope[0]!).toLowerCase().replace(/^./, (c) => c.toUpperCase())} tone={rule.priorityScope[0] === "CRITICAL" ? "red" : "amber"} />
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{rule.levels?.[0]?.approverRole ? formatRoleLabel(rule.levels[0].approverRole!) : "—"}</td>
                  <td className="px-4 py-3">{TRIGGER_LABELS[rule.trigger] ?? rule.trigger}</td>
                  <td className="px-4 py-3">{rule.slaHours ? `${rule.slaHours} h` : "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.isActive}
                      aria-label={rule.isActive ? `Turn off ${rule.name}` : `${rule.name} is off. Edit it to turn it on again.`}
                      disabled={!rule.isActive}
                      title={rule.isActive ? "Click to turn off" : "Off. Edit the rule and save to turn it on again."}
                      onClick={() => void turnOff(rule)}
                      className={`relative h-[22px] w-[38px] rounded-full transition ${rule.isActive ? "bg-blue-600" : "cursor-not-allowed bg-slate-300"}`}
                    >
                      <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all ${rule.isActive ? "left-[19px]" : "left-[3px]"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setEditing({ rule })} className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <RuleDialog
          rule={editing.rule}
          groups={groups}
          approverRoles={approverRoles}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function RuleDialog({
  rule,
  groups,
  approverRoles,
  onClose,
  onSaved
}: {
  rule: RuleWithGroup | null;
  groups: Array<{ id: string; name: string }>;
  approverRoles: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<RuleForm>(rule ? formFromRule(rule) : EMPTY_FORM);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const payload = useMemo(() => payloadFromForm(form), [form]);
  const roleOptions = approverRoles.includes(form.approverRole) ? approverRoles : [form.approverRole, ...approverRoles];
  const field = "h-10 w-full rounded-md border border-slate-300 px-3 text-sm";
  const lab = "mb-1 block text-sm font-medium text-slate-700";
  const set = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setBusy(true);
    try {
      if (rule) {
        await versionApprovalRule(rule.id, payload);
        toast.success(`Saved as v${rule.version + 1}`);
      } else {
        await createApprovalRule(payload);
        toast.success("Rule created");
      }
      await onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Request failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" data-sheet role="dialog" aria-modal="true" aria-label={rule ? "Edit approval rule" : "New approval rule"}>
      <form
        className="my-6 w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{rule ? "Edit approval rule" : "New approval rule"}</h2>
          {rule ? <p className="text-xs text-slate-500">Saving makes version {rule.version + 1}. Earlier versions stay in the history.</p> : null}
        </div>
        <div>
          <label className={lab} htmlFor="rule-name">Rule name</label>
          <input id="rule-name" autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Critical jobs need a manager" className={field} />
        </div>
        <div>
          <label className={lab} htmlFor="rule-process">What needs approval?</label>
          <select id="rule-process" value={form.processType} onChange={(e) => set("processType", e.target.value)} className={field}>
            {Object.entries(PROCESS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lab} htmlFor="rule-approver">Who approves?</label>
            <select id="rule-approver" value={form.approverRole} onChange={(e) => set("approverRole", e.target.value)} className={field}>
              {roleOptions.map((name) => (
                <option key={name} value={name}>{formatRoleLabel(name)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lab} htmlFor="rule-sla">Time limit (hours)</label>
            <input id="rule-sla" inputMode="numeric" value={form.slaHours} onChange={(e) => set("slaHours", e.target.value.replace(/[^0-9]/g, ""))} className={field} />
          </div>
        </div>
        <div>
          <label className={lab} htmlFor="rule-trigger">When?</label>
          <select id="rule-trigger" value={form.trigger} onChange={(e) => set("trigger", e.target.value)} className={field}>
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="text-sm font-medium text-blue-700">
          {more ? "▾" : "▸"} More options (priority, amount, who requests, emergency override)
        </button>
        {more ? (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={lab} htmlFor="rule-priority">Only for priority</label>
                <select id="rule-priority" value={form.priority} onChange={(e) => set("priority", e.target.value)} className={field}>
                  <option value="">Any priority</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lab} htmlFor="rule-amount">Only above this cost</label>
                <input id="rule-amount" inputMode="decimal" value={form.amountThreshold} onChange={(e) => set("amountThreshold", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Optional" className={field} />
              </div>
            </div>
            <div>
              <label className={lab} htmlFor="rule-group">Who requests</label>
              <select id="rule-group" value={form.requesterGroupId} onChange={(e) => set("requesterGroupId", e.target.value)} className={field}>
                <option value="">Everyone</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.emergencyOverrideAllowed} onChange={(e) => set("emergencyOverrideAllowed", e.target.checked)} />
              Allow emergency override (a review afterwards is still required)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                onClick={async () => {
                  try {
                    setResult(await previewApprovalRule(payload));
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, "Request failed"));
                  }
                }}
              >
                Preview impact
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                onClick={async () => {
                  try {
                    setResult(
                      await simulateApprovalRule({
                        processType: form.processType,
                        trigger: form.trigger,
                        priority: form.priority || undefined,
                        estimatedCost: form.amountThreshold ? Number(form.amountThreshold) : undefined
                      })
                    );
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, "Request failed"));
                  }
                }}
              >
                Simulate (nothing is saved)
              </button>
            </div>
            {result ? <pre className="max-h-48 overflow-auto rounded-lg bg-white p-3 text-xs">{JSON.stringify(result, null, 2)}</pre> : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Saving…" : "Save rule"}
          </button>
        </div>
      </form>
    </div>
  );
}
