"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateStoredUserTenant } from "@/lib/auth-storage";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTenantSession } from "@/lib/tenant-session";

type TenantSwitcherProps = {
  id?: string;
  className?: string;
};

export function TenantSwitcher({ id = "tenant-switcher", className = "" }: TenantSwitcherProps) {
  const router = useRouter();
  const { memberships, tenantId, selectTenant } = useTenantSession();
  const [pending, setPending] = useState(false);
  const selectedTenantId = tenantId ?? "";

  if (memberships.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 ${className}`.trim()}>
      <Building2 size={16} className="shrink-0 text-slate-500" />
      <select
        id={id}
        value={selectedTenantId}
        onChange={(event) => {
          const nextTenantId = event.target.value;
          if (!nextTenantId || nextTenantId === selectedTenantId || pending) {
            return;
          }
          setPending(true);
          void selectTenant(nextTenantId)
            .then(() => {
              updateStoredUserTenant(nextTenantId);
              toast.success("Tenant switched successfully");
              router.refresh();
            })
            .catch((error: unknown) => {
              toast.error(getApiErrorMessage(error, "Failed to switch tenant"));
            })
            .finally(() => {
              setPending(false);
            });
        }}
        className="max-w-full flex-1 bg-transparent text-sm text-slate-700 outline-none"
        aria-label="Switch organization"
        disabled={pending}
      >
        <option value="">Select organization</option>
        {memberships.map((membership) => (
          <option key={membership.tenantId} value={membership.tenantId}>
            {membership.tenantName ?? membership.tenantId}
          </option>
        ))}
      </select>
    </div>
  );
}
