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
import {
  IT_HELP_DESK_URL,
  LOGIN_ATTEMPTS_BEFORE_LOCK,
  LOGIN_LOCKOUT_SECONDS,
  formatCountdown,
  formatLockLength,
  lockSecondsFromError,
  throttleSecondsFromError
} from "@/lib/support-links";

type LoginForm = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3.5 text-[15px] text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 aria-[invalid=true]:border-rose-400";

const lockRuleText = `${LOGIN_ATTEMPTS_BEFORE_LOCK} wrong passwords lock the account for ${LOGIN_LOCKOUT_SECONDS.map(formatLockLength).join(", then ")}.`;

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
  // Wrong passwords counted in this browser per email, to warn before the lock.
  const [failedByEmail, setFailedByEmail] = useState<Record<string, number>>({});
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockReason, setLockReason] = useState<"account" | "device">("account");
  const [now, setNow] = useState(() => Date.now());
  const lockSecondsLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const locked = lockSecondsLeft > 0;

  useEffect(() => {
    if (!lockedUntil) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        setLockedUntil(null);
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false
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
    if (busy || locked) return;
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
      const emailKey = resolveLoginEmail(values.email).toLowerCase();
      const accountLockSeconds = lockSecondsFromError(e);
      const deviceWaitSeconds = accountLockSeconds ? null : throttleSecondsFromError(e);
      const lockSeconds = accountLockSeconds ?? deviceWaitSeconds;
      if (lockSeconds) {
        setLockReason(accountLockSeconds ? "account" : "device");
        setFailedByEmail((current) => ({ ...current, [emailKey]: 0 }));
        setNow(Date.now());
        setLockedUntil(Date.now() + lockSeconds * 1000);
        setError(null);
        return;
      }
      const message = mapLoginError(e);
      if (message === "Incorrect email or password.") {
        const failed = (failedByEmail[emailKey] ?? 0) + 1;
        setFailedByEmail((current) => ({ ...current, [emailKey]: failed }));
        const left = LOGIN_ATTEMPTS_BEFORE_LOCK - failed;
        setError(
          left > 0 && failed >= 2
            ? `${message} ${left} ${left === 1 ? "try" : "tries"} left before a short lock.`
            : message
        );
        return;
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-brand-50 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="hidden lg:block lg:p-6">
        <AuthMarketingPanel />
      </div>

      <section className="relative flex min-h-[100dvh] flex-col items-center justify-start px-4 pb-8 pt-6 sm:justify-center sm:px-8 lg:py-10">

        <div className="w-full max-w-[456px] rounded-[20px] border border-brand-100 bg-white px-5 py-7 shadow-[0_1px_2px_rgba(16,77,43,0.05),0_24px_48px_-24px_rgba(16,77,43,0.22)] sm:px-10 sm:py-10">
          {/* The brand panel shows the logo on large screens; the card shows it on phones and tablets. */}
          <div className="flex items-center gap-3 lg:hidden">
            <NelnaLogo decorative size="compact" />
            <div>
              <p className="text-[15px] font-semibold text-slate-900">MaintainPro</p>
              <p className="text-[12.5px] text-slate-500">Nelna Group maintenance desk</p>
            </div>
          </div>

          <header className="mt-7 lg:mt-0">
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
                      placeholder="Your work email"
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
                <div className="-mt-2 flex justify-end text-sm">
                  <a
                    className="font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                    href="/forgot-password"
                  >
                    Forgot password?
                  </a>
                </div>

                {busy ? (
                  <p className="sr-only" role="status" aria-live="polite">
                    Signing in...
                  </p>
                ) : null}

                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-800" htmlFor="login-remember">
                  <input
                    {...register("rememberMe")}
                    className="mt-0.5 h-[18px] w-[18px] cursor-pointer rounded-[5px] border-slate-300 text-brand-600 accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
                    disabled={busy}
                    id="login-remember"
                    type="checkbox"
                  />
                  <span>
                    Keep me signed in on this device
                    <span className="block text-[12.5px] text-slate-500">Only on your own device, not a shared computer.</span>
                  </span>
                </label>

                {locked ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950" role="status" aria-live="polite">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Lock aria-hidden size={15} />
                      {lockReason === "account" ? "Too many wrong passwords" : "Too many sign-in tries from this device"}
                    </p>
                    <p className="mt-1 text-sm">
                      Try again in <span className="font-mono text-base font-semibold tabular-nums">{formatCountdown(lockSecondsLeft)}</span>
                    </p>
                  </div>
                ) : null}

                {error && !locked ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-700 px-4 text-[15px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(21,90,49,0.6)] transition hover:from-brand-600 hover:to-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={busy || locked}
                  type="submit"
                >
                  {locked ? (
                    <>Try again in {formatCountdown(lockSecondsLeft)}</>
                  ) : busy ? (
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

              <p className="mt-3 flex items-start gap-1.5 text-[12.5px] leading-5 text-slate-500">
                <Lock aria-hidden className="mt-0.5 shrink-0" size={13} />
                {lockRuleText}
              </p>

              <p className="mt-6 border-t border-slate-100 pt-5 text-center text-[13.5px] text-slate-500">
                Can&apos;t sign in or need an account?{" "}
                <a
                  className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800"
                  href={IT_HELP_DESK_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Contact IT Help Desk
                  <ExternalLink aria-hidden size={13} />
                </a>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
