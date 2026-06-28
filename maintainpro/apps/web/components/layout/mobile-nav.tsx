"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { AppBrandLockup } from "@/components/brand/app-brand-lockup";
import { NavLinks } from "@/components/layout/nav-links";
import { MOBILE_NAV_DRAWER_ID } from "@/lib/accessibility";

type MobileNavProps = {
  open: boolean;
  onClose: () => void;
  id?: string;
};

export function MobileNav({ open, onClose, id = MOBILE_NAV_DRAWER_ID }: MobileNavProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 xl:hidden" role="presentation">
      <button
        type="button"
        aria-label="Close navigation menu"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <aside
        id={id}
        aria-label="Mobile navigation"
        aria-modal="true"
        role="dialog"
        className="relative flex h-full w-[min(20rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <AppBrandLockup logoSize="sm" showTagline />
          <button
            type="button"
            aria-label="Close navigation menu"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            onClick={onClose}
          >
            <X aria-hidden size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks onNavigate={onClose} />
        </div>
      </aside>
    </div>
  );
}
