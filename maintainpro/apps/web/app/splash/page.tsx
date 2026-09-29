"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { MaintainProLogo } from "@/components/brand/maintainpro-logo";
import { apiClient } from "@/lib/api-client";
import { PRODUCT_TAGLINE } from "@/lib/branding";
import { resolveSplashDestination, type PostLoginUserLike } from "@/lib/role-redirect";

type SplashState = "checking" | "offline" | "error";

export default function SplashPage() {
  const [state, setState] = useState<SplashState>("checking");

  useEffect(() => {
    let cancelled = false;
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    apiClient
      .get<{ data?: PostLoginUserLike }>("/auth/me")
      .then((response) => {
        if (cancelled) return;
        window.location.replace(resolveSplashDestination(response.data?.data, returnTo));
      })
      .catch((error: { response?: { status?: number } }) => {
        if (cancelled) return;
        if (!error?.response) {
          setState("offline");
          return;
        }
        if (error.response.status === 401 || error.response.status === 403) {
          if (!window.location.pathname.startsWith("/login")) {
            window.location.replace("/login");
          }
          return;
        }
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(circle_at_top,_rgba(20,118,214,0.25),_transparent_35%),linear-gradient(135deg,#0f2b46,#115ea8_55%,#0f766e)] p-4 text-white sm:p-6">
      <div className="max-w-xl text-center">
        <MaintainProLogo showTagline size="lg" variant="onDark" />
        <p className="mx-auto mt-6 text-sm leading-7 text-white/80">{PRODUCT_TAGLINE}</p>
        {state === "checking" ? (
          <p className="mt-6 inline-flex items-center justify-center gap-2 text-sm text-white/70" role="status">
            <Loader2 aria-hidden className="animate-spin" size={16} />
            Loading your workspace...
          </p>
        ) : null}
        {state === "offline" ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-white" role="alert">
              MaintainPro could not reach the server. Check your connection and try again.
            </p>
            <button
              className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900"
              type="button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        ) : null}
        {state === "error" ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-white" role="alert">
              MaintainPro could not confirm your session.
            </p>
            <a className="inline-flex min-h-11 items-center text-sm font-semibold underline" href="/login">
              Sign in
            </a>
          </div>
        ) : null}
      </div>
    </main>
  );
}
