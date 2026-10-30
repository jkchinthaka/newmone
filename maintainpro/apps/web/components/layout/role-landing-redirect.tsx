"use client";

import type { Route } from "next";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { resolveAuthorizedDestination } from "@/lib/navigation";
import { useCurrentUser } from "@/lib/use-current-user";

export function RoleLandingRedirect() {
  const router = useRouter();
  const user = useCurrentUser();
  const target = resolveAuthorizedDestination({ role: user.role }, null, user.permissions ?? []);

  useEffect(() => {
    if (!target || target === "/action-center" || target === "/splash" || target === "/login") {
      return;
    }
    router.replace(target as Route);
  }, [router, target]);

  return (
    <p className="p-6 text-sm text-slate-600" role="status">
      Opening your workspace...
    </p>
  );
}
