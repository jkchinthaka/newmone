"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel";
import { AppBrandLockup } from "@/components/brand/app-brand-lockup";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { setAuthSession } from "@/lib/auth-storage";
import { resolveLoginEmail, validateWorkEmail } from "@/lib/login-identifier";
import { getPostLoginRedirect } from "@/lib/role-redirect";
import { setActiveTenantId } from "@/lib/tenant-context";

type LoginForm = {
  email: string;
  password: string;
};

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      setError("Your session expired. Sign in again to continue.");
    }
  }, []);

  const onSubmit = async (values: LoginForm) => {
    setBusy(true);
    setError(null);

    try {
      const res = await apiClient.post("/auth/login", {
        email: resolveLoginEmail(values.email),
        password: values.password
      });
      const payload = res.data?.data;

      if (!payload?.user) {
        setError("Sign-in failed. Please try again.");
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

      setActiveTenantId(
        typeof tenantIdCandidate === "string" ? tenantIdCandidate : null
      );

      window.location.replace(getPostLoginRedirect(payload.user));
    } catch (e) {
      setError(
        getApiErrorMessage(
          e,
          INVALID_CREDENTIALS_MESSAGE
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,118,214,0.16),_transparent_40%),linear-gradient(135deg,#f7fafc,#e2ebf5)] p-4 sm:p-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
      <AuthMarketingPanel />

      <section className="flex items-center justify-center py-4 lg:py-6">
        <div className="w-full max-w-md rounded-[32px] border border-white/60 bg-white/92 p-6 shadow-[0_32px_80px_rgba(15,23,42,0.14)] backdrop-blur sm:max-w-xl sm:p-8 xl:p-10">
          <AppBrandLockup centered className="w-full" logoSize="md" showTagline />

          <header className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-2 text-base text-slate-600">Sign in to your workspace</p>
          </header>

          <form
            aria-busy={busy}
            className="mt-8 space-y-5"
            noValidate
            onSubmit={handleSubmit(onSubmit)}
          >
            <label className="block text-sm" htmlFor="login-email">
              <span className="mb-2 block font-medium text-slate-700">Work Email</span>
              <input
                {...register("email", {
                  validate: (value) => validateWorkEmail(value) ?? true
                })}
                aria-describedby={errors.email ? "login-email-error" : undefined}
                aria-invalid={errors.email ? "true" : "false"}
                autoComplete="email"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                disabled={busy}
                id="login-email"
                inputMode="email"
                name="email"
                placeholder="you@company.com"
                type="email"
              />
              {errors.email?.message ? (
                <p id="login-email-error" className="mt-2 text-sm text-rose-600" role="alert">
                  {errors.email.message}
                </p>
              ) : null}
            </label>

            <label className="block text-sm" htmlFor="login-password">
              <span className="mb-2 block font-medium text-slate-700">Password</span>
              <div className="relative">
                <input
                  {...register("password", {
                    required: "Password is required",
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters"
                    }
                  })}
                  aria-describedby={errors.password ? "login-password-error" : undefined}
                  aria-invalid={errors.password ? "true" : "false"}
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 pr-12 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  disabled={busy}
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-controls="login-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-r-2xl px-4 text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  disabled={busy}
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
                </button>
              </div>
              {errors.password?.message ? (
                <p id="login-password-error" className="mt-2 text-sm text-rose-600" role="alert">
                  {errors.password.message}
                </p>
              ) : null}
            </label>

            {busy ? (
              <p className="sr-only" role="status" aria-live="polite">
                Signing in...
              </p>
            ) : null}

            <div className="flex items-center justify-end text-sm">
              <a
                className="font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
                href="/forgot-password"
              >
                Forgot password?
              </a>
            </div>

            <button
              className="min-h-11 w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-70"
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

            {error ? (
              <p
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-slate-500">
            Access is by invitation. Contact your administrator if you need an account.
          </p>
        </div>
      </section>
    </main>
  );
}
