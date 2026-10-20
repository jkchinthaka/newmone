"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { resolveAuthorizedDestination } from "@/lib/navigation";
import type { PostLoginUserLike } from "@/lib/role-redirect";

type EntryProblem = "offline" | "error";

function permissionsOf(user: unknown): string[] {
  if (!user || typeof user !== "object" || !("permissions" in user)) return [];
  const value = (user as { permissions?: unknown }).permissions;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Confirms the session and leaves for an authorized route. No branded splash. */
export function SessionEntry() {
  const [problem, setProblem] = useState<EntryProblem | null>(null);

  useEffect(() => {
    let cancelled = false;
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    apiClient
      .get<{ data?: PostLoginUserLike }>("/auth/me")
      .then((response) => {
        if (cancelled) return;
        const user = response.data?.data;
        window.location.replace(resolveAuthorizedDestination(user, returnTo, permissionsOf(user)));
      })
      .catch((error: { response?: { status?: number } }) => {
        if (cancelled) return;
        if (!error?.response) {
          setProblem("offline");
          return;
        }
        if (error.response.status === 401 || error.response.status === 403) {
          window.location.replace("/login");
          return;
        }
        setProblem("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-slate-100 p-6 text-slate-700">
      {problem === null ? (
        <p className="text-sm" role="status">
          Checking your session...
        </p>
      ) : null}
      {problem === "offline" ? (
        <div className="max-w-md space-y-3 text-center">
          <p className="text-sm" role="alert">
            MaintainPro could not reach the server. Check your connection and try again.
          </p>
          <button
            className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      ) : null}
      {problem === "error" ? (
        <div className="max-w-md space-y-3 text-center">
          <p className="text-sm" role="alert">
            MaintainPro could not confirm your session.
          </p>
          <a className="inline-flex min-h-11 items-center text-sm font-semibold underline" href="/login">
            Sign in
          </a>
        </div>
      ) : null}
    </main>
  );
}
