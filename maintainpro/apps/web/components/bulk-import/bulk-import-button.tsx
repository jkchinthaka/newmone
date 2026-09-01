"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";

import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";
import type { BulkImportEntitySlug } from "@/lib/bulk-import-api";

import { BulkImportWizard } from "./bulk-import-wizard";

export interface BulkImportButtonProps {
  entity: BulkImportEntitySlug;
  entityLabel: string;
  onImported?: () => void;
  className?: string;
  /**
   * "dark" matches header buttons on a dark/gradient hero section (e.g. Vehicles);
   * "light" matches the default white-card button style used on most pages.
   */
  variant?: "dark" | "light";
}

const VARIANT_CLASS: Record<"dark" | "light", string> = {
  dark: "bg-white text-slate-900 hover:bg-slate-100",
  light: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
};

/**
 * V1 bulk import is SUPER_ADMIN only. This is a UX convenience — the server
 * independently re-verifies the actor's role against the database on every
 * preview and commit call, so hiding this button is not the security
 * boundary (see docs/BULK_IMPORT_ARCHITECTURE.md).
 */
export function BulkImportButton({ entity, entityLabel, onImported, className, variant = "light" }: BulkImportButtonProps) {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const [open, setOpen] = useState(false);

  if (roleName !== "SUPER_ADMIN") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          `inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${VARIANT_CLASS[variant]}`
        }
      >
        <UploadCloud size={14} aria-hidden /> Bulk Upload
      </button>
      <BulkImportWizard
        entity={entity}
        entityLabel={entityLabel}
        open={open}
        onClose={() => setOpen(false)}
        onImported={onImported}
      />
    </>
  );
}
