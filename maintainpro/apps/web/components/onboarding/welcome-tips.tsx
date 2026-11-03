"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { resolveRoleHome } from "@/lib/role-home";
import { getStoredRole } from "@/lib/user-role";
import { currentStoredUserId } from "@/lib/user-scoped-storage";
import { welcomeGuideForRole } from "@/lib/welcome-tips";

const DISMISS_KEY = "maintainpro:welcome-dismissed:v1";

/** By person only: the company id loads a moment after the page, so a company-based key would change under us. */
function dismissKey(userId: string): string {
  return `${DISMISS_KEY}:${userId}`;
}

/** Shown once per person on this device; "Got it" hides it for good. */
export function WelcomeTips() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const userId = currentStoredUserId();
      if (!userId) return;
      setVisible(window.localStorage.getItem(dismissKey(userId)) !== "1");
    } catch {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;
  const storedRole = getStoredRole();
  const guide = welcomeGuideForRole(storedRole, resolveRoleHome(storedRole).roleKey);

  const dismiss = () => {
    setVisible(false);
    try {
      const userId = currentStoredUserId();
      if (userId) window.localStorage.setItem(dismissKey(userId), "1");
    } catch {
      // Without storage the guide simply shows again next visit.
    }
  };

  return (
    <section aria-label="Getting started" className="relative mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close getting started"
        className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-emerald-900 hover:bg-emerald-100"
      >
        <X aria-hidden size={18} />
      </button>
      <h2 className="pr-10 text-base font-semibold text-emerald-950">{guide.title}</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-emerald-950">
        {guide.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Got it
      </button>
    </section>
  );
}
