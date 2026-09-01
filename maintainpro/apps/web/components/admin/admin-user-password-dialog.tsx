"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { useFocusTrap } from "@/lib/use-focus-trap";
import { setAdminUserPassword } from "@/lib/admin-users-api";

export interface AdminUserPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  userId: string | null;
  userLabel: string;
}

const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function AdminUserPasswordDialog({ open, onClose, onSaved, userId, userLabel }: AdminUserPasswordDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [newPassword, setNewPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusTrap(open, panelRef, { onEscape: submitting ? undefined : onClose });

  useEffect(() => {
    if (open) {
      setNewPassword("");
      setMustChangePassword(true);
      setAutoGenerate(true);
      setError(null);
    }
  }, [open]);

  if (!open || !userId) {
    return null;
  }

  async function handleSubmit() {
    if (!autoGenerate && !PASSWORD_POLICY.test(newPassword)) {
      setError("At least 8 characters, one uppercase letter, one number, and one special character");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await setAdminUserPassword(userId as string, {
        newPassword: autoGenerate ? undefined : newPassword,
        mustChangePassword
      });
      if (result.temporaryPassword) {
        toast.success(`Password reset. Temporary password: ${result.temporaryPassword}`, { duration: 15000 });
      } else {
        toast.success("Password updated. All existing sessions for this user were signed out.");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password update failed");
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
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            Set / Reset Password
          </h2>
          <button type="button" onClick={submitting ? undefined : onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          Setting a new password for <span className="font-semibold text-slate-900">{userLabel}</span> will immediately sign them
          out of every active session.
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />
            Auto-generate a temporary password
          </label>

          {!autoGenerate ? (
            <div className="space-y-1">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
              />
              {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={mustChangePassword} onChange={(e) => setMustChangePassword(e.target.checked)} />
            Require password change at next login
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Set Password
          </button>
        </div>
      </div>
    </div>
  );
}
