"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  PERMISSION_OVERRIDE_SCOPE_NOTE,
  permissionOverrideDeleteConfig,
  removalReasonIsNew
} from "@/lib/permission-overrides";

type OverrideRow = {
  id: string;
  permissionKey: string;
  effect: string;
  reason: string;
  expiresAt?: string | null;
};

type PermissionOption = {
  key: string;
  description?: string | null;
};

export function PermissionOverridesCard({
  userId,
  permissionOptions
}: {
  userId: string;
  permissionOptions: PermissionOption[];
}) {
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionKey, setPermissionKey] = useState(permissionOptions[0]?.key ?? "");
  const [effect, setEffect] = useState<"GRANT" | "DENY">("GRANT");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [removalReasons, setRemovalReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ data: OverrideRow[] }>(
        `/admin/users/${userId}/permission-overrides`
      );
      setRows(response.data.data ?? []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load permission overrides."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Reload when the edited user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addOverride = async () => {
    if (!permissionKey || !reason.trim()) {
      toast.error("Choose a permission and enter a reason.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post(`/admin/users/${userId}/permission-overrides`, {
        permissionKey,
        effect,
        reason: reason.trim(),
        expiresAt: expiresAt || null
      });
      setReason("");
      setExpiresAt("");
      toast.success("Permission override saved.");
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not save the permission override."));
    } finally {
      setBusy(false);
    }
  };

  const removeOverride = async (row: OverrideRow) => {
    const removalReason = removalReasons[row.id] ?? "";
    if (!removalReasonIsNew(row.reason, removalReason)) {
      toast.error("Enter a new removal reason.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.delete(
        `/admin/users/${userId}/permission-overrides`,
        permissionOverrideDeleteConfig(row.permissionKey, removalReason.trim())
      );
      toast.success("Permission override removed.");
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not remove the permission override."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-5 mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Permission overrides</h3>
      <p className="mt-1 text-xs text-slate-500">
        Grant adds a permission. Deny removes it, including one the role already has.
      </p>
      <p className="mt-1 text-xs text-slate-500">{PERMISSION_OVERRIDE_SCOPE_NOTE}</p>

      {loading ? <p className="mt-3 text-sm text-slate-500">Loading overrides…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No overrides for this user.</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">
                  {row.permissionKey}{" "}
                  <span className="text-xs font-semibold uppercase text-slate-500">{row.effect}</span>
                </p>
                <p className="text-xs text-slate-500">{row.reason}</p>
                {row.expiresAt ? (
                  <p className="text-xs text-slate-500">Expires {row.expiresAt.slice(0, 10)}</p>
                ) : null}
                <label className="mt-2 block text-xs font-medium text-slate-600">
                  Removal reason
                  <input
                    value={removalReasons[row.id] ?? ""}
                    onChange={(event) =>
                      setRemovalReasons((current) => ({ ...current, [row.id]: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy || !removalReasonIsNew(row.reason, removalReasons[row.id] ?? "")}
                onClick={() => void removeOverride(row)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          Permission
          <select
            value={permissionKey}
            onChange={(event) => setPermissionKey(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {permissionOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.key}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Effect
          <select
            value={effect}
            onChange={(event) => setEffect(event.target.value === "DENY" ? "DENY" : "GRANT")}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="GRANT">Grant</option>
            <option value="DENY">Deny</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Expires
          <input
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          />
        </label>
        <label className="text-xs font-medium text-slate-600 sm:col-span-2">
          Reason
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void addOverride()}
        className="mt-3 inline-flex items-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        Add override
      </button>
    </section>
  );
}
