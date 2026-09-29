"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { MaintainProLogo } from "@/components/brand/maintainpro-logo";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { PRODUCT_TAGLINE } from "@/lib/branding";

type ResetForm = { newPassword: string };

const passwordRule = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<ResetForm>();

  const onSubmit = async (values: ResetForm) => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/auth/reset-password", { token, newPassword: values.newPassword });
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "This reset link is invalid or has expired."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-slate-100 p-4">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <MaintainProLogo showTagline size="md" />
        <header className="mt-6">
          <h1 className="text-2xl font-semibold text-slate-900">Choose a new password</h1>
          <p className="mt-2 text-sm text-slate-600">{PRODUCT_TAGLINE}</p>
        </header>
        {!token ? (
          <p className="mt-4 text-sm text-rose-700" role="alert">
            This reset link is invalid or has expired.
          </p>
        ) : null}
        {done ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            Your password has been changed. You can sign in with the new password.
          </p>
        ) : (
          <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
            <label className="block text-sm" htmlFor="reset-password">
              <span className="mb-1.5 block font-medium text-slate-700">New password</span>
              <input
                {...register("newPassword", {
                  required: "Enter a new password.",
                  validate: (value) =>
                    passwordRule.test(value) ||
                    "Use at least 8 characters, with one uppercase letter, one number, and one special character."
                })}
                aria-describedby={errors.newPassword ? "reset-password-error" : undefined}
                aria-invalid={errors.newPassword ? "true" : "false"}
                autoComplete="new-password"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                disabled={busy || !token}
                id="reset-password"
                type="password"
              />
              {errors.newPassword?.message ? (
                <p id="reset-password-error" className="mt-1.5 text-sm text-rose-700" role="alert">
                  {errors.newPassword.message}
                </p>
              ) : null}
            </label>
            <button
              className="min-h-11 w-full rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
              disabled={busy || !token}
              type="submit"
            >
              {busy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 aria-hidden className="animate-spin" size={16} />
                  Saving
                </span>
              ) : (
                "Save password"
              )}
            </button>
            {error ? (
              <p className="text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
        <p className="mt-6 text-sm text-slate-600">
          <Link className="font-medium text-brand-700 underline" href="/login">
            Return to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
