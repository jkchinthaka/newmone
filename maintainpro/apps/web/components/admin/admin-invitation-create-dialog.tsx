"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { joinAriaDescribedBy } from "@/lib/accessibility";
import {
  ADMIN_INVITATION_CREATABLE_MEMBERSHIP_ROLES,
  formatMembershipRoleLabel,
  validateAdminInvitationCreateInput,
  type AdminInvitationCreatableMembershipRole
} from "@/lib/admin-invitations";

export type AdminInvitationCreateDialogProps = {
  open: boolean;
  isSubmitting?: boolean;
  isSuperAdmin?: boolean;
  tenantOptions?: Array<{ id: string; name: string }>;
  defaultTenantId?: string | null;
  fixedTenantName?: string | null;
  onSubmit: (payload: {
    email: string;
    firstName?: string;
    lastName?: string;
    membershipRole: AdminInvitationCreatableMembershipRole;
    tenantId?: string;
  }) => void;
  onCancel: () => void;
};

export function AdminInvitationCreateDialog({
  open,
  isSubmitting = false,
  isSuperAdmin = false,
  tenantOptions = [],
  defaultTenantId = null,
  fixedTenantName = null,
  onSubmit,
  onCancel
}: AdminInvitationCreateDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [membershipRole, setMembershipRole] = useState<AdminInvitationCreatableMembershipRole>("MEMBER");
  const [tenantId, setTenantId] = useState(defaultTenantId ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setEmail("");
    setFirstName("");
    setLastName("");
    setMembershipRole("MEMBER");
    setTenantId(defaultTenantId ?? tenantOptions[0]?.id ?? "");
    setError(null);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      emailRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, defaultTenantId, tenantOptions, isSubmitting, onCancel]);

  if (!open) {
    return null;
  }

  function handleSubmit() {
    const validationError = validateAdminInvitationCreateInput({
      email,
      firstName,
      lastName,
      membershipRole,
      tenantId: isSuperAdmin ? tenantId : undefined
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    onSubmit({
      email: email.trim(),
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      membershipRole,
      tenantId: isSuperAdmin ? tenantId : undefined
    });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0"
        onClick={isSubmitting ? undefined : onCancel}
        disabled={isSubmitting}
      />
      <div
        aria-busy={isSubmitting}
        aria-describedby={joinAriaDescribedBy(descriptionId, error ? errorId : undefined)}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:max-h-none"
        role="dialog"
      >
        <h2 className="text-lg font-semibold text-slate-900" id={titleId}>
          Create invitation
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600" id={descriptionId}>
          Send a controlled onboarding invitation for an existing tenant workspace. Email dispatch is not enabled in
          this release; copy the one-time link after creation.
        </p>

        <div className="mt-4 space-y-4">
          {isSuperAdmin ? (
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Tenant</span>
              <select
                value={tenantId}
                disabled={isSubmitting}
                onChange={(event) => {
                  setTenantId(event.target.value);
                  if (error) {
                    setError(null);
                  }
                }}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
              >
                {tenantOptions.length === 0 ? (
                  <option value="">No tenants available</option>
                ) : (
                  tenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : fixedTenantName ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              <span className="font-medium text-slate-900">Tenant:</span> {fixedTenantName}
            </div>
          ) : null}

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Work email</span>
            <input
              ref={emailRef}
              type="email"
              autoComplete="email"
              value={email}
              disabled={isSubmitting}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">First name (optional)</span>
              <input
                type="text"
                value={firstName}
                disabled={isSubmitting}
                onChange={(event) => setFirstName(event.target.value)}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Last name (optional)</span>
              <input
                type="text"
                value={lastName}
                disabled={isSubmitting}
                onChange={(event) => setLastName(event.target.value)}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Membership role</span>
            <select
              value={membershipRole}
              disabled={isSubmitting}
              onChange={(event) =>
                setMembershipRole(event.target.value as AdminInvitationCreatableMembershipRole)
              }
              className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
            >
              {ADMIN_INVITATION_CREATABLE_MEMBERSHIP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {formatMembershipRoleLabel(role)}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <p id={errorId} className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || (isSuperAdmin && tenantOptions.length === 0)}
            onClick={handleSubmit}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
            Create invitation
          </button>
        </div>
      </div>
    </div>
  );
}
