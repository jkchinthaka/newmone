"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { MaintainProLogo } from "@/components/brand/maintainpro-logo";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { setAuthSession } from "@/lib/auth-storage";
import { PRODUCT_TAGLINE } from "@/lib/branding";
import { getPostLoginRedirect } from "@/lib/role-redirect";

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const fieldClass =
  "min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

export function RegisterFormCard() {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitationToken");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit } = useForm<RegisterForm>();

  const onSubmit = async (values: RegisterForm) => {
    if (!invitationToken) return;
    if (values.password !== values.confirmPassword) {
      setError("Password and confirmation must match.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await apiClient.post("/auth/register", {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        invitationToken
      });
      const payload = res.data?.data;
      if (!payload?.user) {
        setError("Registration failed. Please try again.");
        return;
      }
      setAuthSession({ user: payload.user });
      window.location.replace(getPostLoginRedirect(payload.user));
    } catch (err) {
      setError(getApiErrorMessage(err, "Registration failed. Check your details and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-slate-100 p-4 sm:p-6">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <MaintainProLogo showTagline size="md" />
        <header className="mt-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            {invitationToken ? "Join your workspace" : "Registration is by invitation"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{PRODUCT_TAGLINE}</p>
        </header>

        {invitationToken ? (
          <form className="mt-6 grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit(onSubmit)}>
            <p className="sm:col-span-2 text-sm text-slate-600">
              Use the email address the invitation was sent to. The workspace and role come from that invitation.
            </p>
            <label className="text-sm" htmlFor="register-first-name">
              <span className="mb-1.5 block font-medium text-slate-700">First name</span>
              <input id="register-first-name" className={fieldClass} autoComplete="given-name" {...register("firstName", { required: true })} />
            </label>
            <label className="text-sm" htmlFor="register-last-name">
              <span className="mb-1.5 block font-medium text-slate-700">Last name</span>
              <input id="register-last-name" className={fieldClass} autoComplete="family-name" {...register("lastName", { required: true })} />
            </label>
            <label className="text-sm sm:col-span-2" htmlFor="register-email">
              <span className="mb-1.5 block font-medium text-slate-700">Email</span>
              <input id="register-email" className={fieldClass} type="email" autoComplete="email" {...register("email", { required: true })} />
            </label>
            <label className="text-sm" htmlFor="register-password">
              <span className="mb-1.5 block font-medium text-slate-700">Password</span>
              <input id="register-password" className={fieldClass} type="password" autoComplete="new-password" {...register("password", { required: true })} />
            </label>
            <label className="text-sm" htmlFor="register-confirm-password">
              <span className="mb-1.5 block font-medium text-slate-700">Confirm password</span>
              <input id="register-confirm-password" className={fieldClass} type="password" autoComplete="new-password" {...register("confirmPassword", { required: true })} />
            </label>
            {error ? (
              <p className="sm:col-span-2 text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
            <button className="min-h-11 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70 sm:col-span-2" disabled={busy} type="submit">
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 aria-hidden className="animate-spin" size={16} />
                  Creating account
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
            <p>
              MaintainPro accounts are created by an administrator. Open registration does not create a tenant or an administrator.
            </p>
            <p>If you received a personal invitation, open that link to set your password. A workspace invitation includes its own registration link.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white" href="/login">
                Sign in
              </Link>
              <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800" href="/accept-invite">
                Accept an invitation
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
