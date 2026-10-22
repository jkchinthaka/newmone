"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight, ExternalLink, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel";
import { NelnaLogo } from "@/components/brand/nelna-logo";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { setAuthSession } from "@/lib/auth-storage";
import { resolveLoginEmail, validateWorkEmail } from "@/lib/login-identifier";
import { resolveAuthorizedDestination } from "@/lib/navigation";
import { safeInternalReturnPath, type PostLoginUserLike } from "@/lib/role-redirect";
import { setActiveTenantId } from "@/lib/tenant-context";
import { IT_HELP_DESK_URL, LOGIN_ATTEMPTS_BEFORE_LOCK, LOGIN_LOCKOUT_MINUTES } from "@/lib/support-links";

type LoginForm = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3.5 text-[15px] text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 aria-[invalid=true]:border-rose-400";

const lockRounds = ["1st lock", "2nd lock", "3rd lock"] as const;

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
  const [sessionCheck, setSessionCheck] = useState<"checking" | "form">("checking");
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true
    }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session_expired") {
      setSessionNotice("Your session has expired. Please sign in again.");
    }
    const nextReturn = safeInternalReturnPath(params.get("returnTo"));
    setReturnTo(nextReturn);
    let cancelled = false;
    apiClient
      .get<{ data?: PostLoginUserLike }>("/auth/me")
      .then((response) => {
        if (cancelled) return;
        const user = response.data?.data;
        const permissions = Array.isArray((user as { permissions?: unknown } | undefined)?.permissions)
          ? ((user as { permissions?: unknown }).permissions as unknown[]).filter(
              (item): item is string => typeof item === "string"
            )
          : [];
        window.location.replace(resolveAuthorizedDestination(user, nextReturn, permissions));
      })
      .catch(() => {
        if (!cancelled) setSessionCheck("form");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const passwordField = register("password", {
    required: "Please enter your password."
  });

  const onSubmit = async (values: LoginForm) => {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await apiClient.post(
        "/auth/login",
        {
          email: resolveLoginEmail(values.email),
          password: values.password
        },
        // The BFF keeps the session cookies past browser close only when this is "1".
        { headers: { "x-remember-me": values.rememberMe ? "1" : "0" } }
      );
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

      const permissions = Array.isArray(payload.user?.permissions)
        ? (payload.user.permissions as unknown[]).filter((item): item is string => typeof item === "string")
        : [];
      window.location.replace(resolveAuthorizedDestination(payload.user, returnTo, permissions));
    } catch (e) {
      setError(mapLoginError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-brand-50 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="hidden lg:block lg:p-6">
        <AuthMarketingPanel />
      </div>

      <section className="relative flex min-h-[100dvh] flex-col items-center justify-start px-4 pb-8 pt-6 sm:px-8 lg:justify-center lg:py-10">
        <p className="mb-6 flex w-full max-w-[456px] items-center justify-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2 text-[13px] text-slate-600 shadow-sm lg:absolute lg:right-8 lg:top-7 lg:mb-0 lg:w-auto">
          Can&apos;t sign in?
          <a
            className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            href={IT_HELP_DESK_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            Contact IT Help Desk
            <ExternalLink aria-hidden size={13} />
          </a>
        </p>

        <div className="w-full max-w-[456px] rounded-[20px] border border-brand-100 bg-white px-5 py-7 shadow-[0_1px_2px_rgba(16,77,43,0.05),0_24px_48px_-24px_rgba(16,77,43,0.22)] sm:px-10 sm:py-10">
          <div className="flex items-center gap-3">
            <NelnaLogo decorative size="compact" />
            <div>
              <p className="text-[15px] font-semibold text-slate-900">MaintainPro</p>
              <p className="text-[12.5px] text-slate-500">Nelna Group maintenance desk</p>
            </div>
          </div>

          <header className="mt-7">
            <h1 className="text-[23px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[26px]">
              Sign in to MaintainPro
            </h1>
            <p className="mt-1.5 text-[14.5px] text-slate-600">
              Use the work email your administrator registered for you.
            </p>
          </header>

          {sessionCheck === "checking" ? (
            <p className="mt-6 text-sm text-slate-600" role="status">
              Checking your session...
            </p>
          ) : (
            <>
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
                className="mt-6 space-y-[18px]"
                method="post"
                noValidate
                onSubmit={handleSubmit(onSubmit)}
              >
                <label className="block text-sm" htmlFor="login-email">
                  <span className="mb-1.5 block font-medium text-slate-700">Work email</span>
                  <span className="relative block">
                    <Mail aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
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
                      placeholder="name@nelna.lk"
                      type="email"
                    />
                  </span>
                  {errors.email?.message ? (
                    <p id="login-email-error" className="mt-1.5 text-sm text-rose-700" role="alert">
                      {errors.email.message}
                    </p>
                  ) : null}
                </label>

                <label className="block text-sm" htmlFor="login-password">
                  <span className="mb-1.5 block font-medium text-slate-700">Password</span>
                  <span className="relative block">
                    <Lock aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
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
                      {showPassword ? <EyeOff aria-hidden size={19} /> : <Eye aria-hidden size={19} />}
                    </button>
                  </span>
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

                <div className="flex flex-col gap-3 text-sm min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                  <label className="inline-flex cursor-pointer items-center gap-2.5 whitespace-nowrap text-slate-800" htmlFor="login-remember">
                    <input
                      {...register("rememberMe")}
                      className="h-[18px] w-[18px] cursor-pointer rounded-[5px] border-slate-300 text-brand-600 accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
                      disabled={busy}
                      id="login-remember"
                      type="checkbox"
                    />
                    Keep me signed in on this device
                  </label>
                  <a
                    className="whitespace-nowrap font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
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
                  className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-700 px-4 text-[15px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(21,90,49,0.6)] transition hover:from-brand-600 hover:to-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? (
                    <>
                      <Loader2 aria-hidden className="animate-spin" size={16} />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight aria-hidden size={16} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-amber-900">
                  <Lock aria-hidden size={15} />
                  {LOGIN_ATTEMPTS_BEFORE_LOCK} wrong passwords lock the account
                </p>
                <ol className="mt-2.5 grid grid-cols-3 gap-2">
                  {LOGIN_LOCKOUT_MINUTES.map((minutes, index) => (
                    <li
                      key={minutes}
                      className={`rounded-lg border px-2 py-1.5 text-center ${
                        index === LOGIN_LOCKOUT_MINUTES.length - 1
                          ? "border-amber-300 bg-amber-100/70"
                          : "border-amber-200 bg-white"
                      }`}
                    >
                      <span className="block font-mono text-[10.5px] uppercase tracking-wider text-amber-800/80">
                        {lockRounds[index]}
                      </span>
                      <span
                        className={`text-[15px] font-semibold ${
                          index === LOGIN_LOCKOUT_MINUTES.length - 1 ? "text-amber-700" : "text-slate-900"
                        }`}
                      >
                        {minutes} min
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <p className="mt-6 border-t border-slate-100 pt-5 text-center text-[13.5px] text-slate-500">
                Need an account?{" "}
                <a
                  className="font-semibold text-brand-700 hover:text-brand-800"
                  href={IT_HELP_DESK_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Raise a Help Desk ticket
                </a>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
