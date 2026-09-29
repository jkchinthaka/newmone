"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel";
import { AppBrandLockup } from "@/components/brand/app-brand-lockup";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { setAuthSession } from "@/lib/auth-storage";
import { resolveLoginEmail, validateWorkEmail } from "@/lib/login-identifier";
import { getPostLoginRedirect, safeInternalReturnPath } from "@/lib/role-redirect";
import { setActiveTenantId } from "@/lib/tenant-context";

type LoginForm = {
  email: string;
  password: string;
};

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 aria-[invalid=true]:border-rose-400";

function mapLoginError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const raw = getApiErrorMessage(error, "We could not sign you in. Please try again.");
  const text = raw.toLowerCase();
  if (status === 429 || text.includes("too many") || text.includes("throttl")) {
    return "Too many sign-in attempts. Please try again later.";
  }
  if (text.includes("inactive") || text.includes("disabled") || text.includes("suspended")) {
    return "Your account is currently inactive.";
  }
  if (text.includes("temporary password")) {
    return raw;
  }
  if (
    status === 401 ||
    text.includes("invalid email") ||
    text.includes("invalid credentials") ||
    text.includes("unauthorized")
  ) {
    return "Incorrect email or password.";
  }
  return "We could not sign you in. Please try again.";
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: ""
    }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session_expired") {
      setSessionNotice("Your session has expired. Please sign in again.");
    }
    setReturnTo(safeInternalReturnPath(params.get("returnTo")));
  }, []);

  const passwordField = register("password", {
    required: "Please enter your password."
  });

  const onSubmit = async (values: LoginForm) => {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await apiClient.post("/auth/login", {
        email: resolveLoginEmail(values.email),
        password: values.password
      });
      const payload = res.data?.data;

      if (!payload?.user) {
        setError("We could not sign you in. Please try again.");
        return;
      }

      setAuthSession({
        user: payload.user
      });

      const tenantIdCandidate =
        payload.user &&
        typeof payload.user === "object" &&
        "tenantId" in (payload.user as Record<string, unknown>)
          ? (payload.user as { tenantId?: unknown }).tenantId
          : null;

      setActiveTenantId(typeof tenantIdCandidate === "string" ? tenantIdCandidate : null);

      window.location.replace(returnTo ?? getPostLoginRedirect(payload.user));
    } catch (e) {
      setError(mapLoginError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] bg-slate-100 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="p-4 lg:p-6">
        <AuthMarketingPanel />
        <div className="mb-4 flex justify-center lg:hidden">
          <AppBrandLockup centered logoSize="sm" />
        </div>
      </div>

      <section className="flex items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm sm:px-10">
          <div className="hidden lg:block">
            <AppBrandLockup logoSize="sm" />
          </div>

          <header className="mt-0 lg:mt-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-600">Sign in to MaintainPro</p>
          </header>

          {sessionNotice ? (
            <p
              className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
              role="status"
            >
              {sessionNotice}
            </p>
          ) : null}

          <form
            aria-busy={busy}
            className="mt-6 space-y-4"
            method="post"
            noValidate
            onSubmit={handleSubmit(onSubmit)}
          >
            <label className="block text-sm" htmlFor="login-email">
              <span className="mb-1.5 block font-medium text-slate-700">Email address</span>
              <input
                {...register("email", {
                  validate: (value) => validateWorkEmail(value) ?? true
                })}
                aria-describedby={errors.email ? "login-email-error" : undefined}
                aria-invalid={errors.email ? "true" : "false"}
                autoComplete="email"
                className={fieldClass}
                disabled={busy}
                id="login-email"
                inputMode="email"
                name="email"
                placeholder="you@company.com"
                type="email"
              />
              {errors.email?.message ? (
                <p id="login-email-error" className="mt-1.5 text-sm text-rose-700" role="alert">
                  {errors.email.message}
                </p>
              ) : null}
            </label>

            <label className="block text-sm" htmlFor="login-password">
              <span className="mb-1.5 block font-medium text-slate-700">Password</span>
              <div className="relative">
                <input
                  {...passwordField}
                  aria-describedby={
                    [errors.password ? "login-password-error" : null, capsLock ? "login-caps-lock" : null]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  aria-invalid={errors.password ? "true" : "false"}
                  autoComplete="current-password"
                  className={`${fieldClass} pr-12`}
                  disabled={busy}
                  id="login-password"
                  name="password"
                  onBlur={(event) => {
                    passwordField.onBlur(event);
                    setCapsLock(false);
                  }}
                  onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-controls="login-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  disabled={busy}
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
                </button>
              </div>
              {capsLock ? (
                <p id="login-caps-lock" className="mt-1.5 text-sm text-amber-800">
                  Caps Lock is on
                </p>
              ) : null}
              {errors.password?.message ? (
                <p id="login-password-error" className="mt-1.5 text-sm text-rose-700" role="alert">
                  {errors.password.message}
                </p>
              ) : null}
            </label>

            {busy ? (
              <p className="sr-only" role="status" aria-live="polite">
                Signing in...
              </p>
            ) : null}

            <div className="flex justify-end text-sm">
              <a
                className="font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                href="/forgot-password"
              >
                Forgot password?
              </a>
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                {error}
              </p>
            ) : null}

            <button
              className="min-h-11 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={busy}
              type="submit"
            >
              {busy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 aria-hidden className="animate-spin" size={16} />
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Access is by invitation. Contact your system administrator if you need an account.
          </p>
        </div>
      </section>
    </main>
  );
}
