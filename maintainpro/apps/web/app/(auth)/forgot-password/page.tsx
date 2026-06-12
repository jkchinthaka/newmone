"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { MaintainProLogo } from "@/components/brand/maintainpro-logo";
import { apiClient } from "@/lib/api-client";
import { PRODUCT_TAGLINE } from "@/lib/branding";

type ForgotPasswordForm = {
  email: string;
};

export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit } = useForm<ForgotPasswordForm>();

  const onSubmit = async (values: ForgotPasswordForm) => {
    setBusy(true);
    try {
      await apiClient.post("/auth/forgot-password", values);
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(20,118,214,0.16),_transparent_40%),linear-gradient(135deg,#f7fafc,#e2ebf5)] p-6">
      <section className="w-full max-w-lg rounded-[32px] border border-white/60 bg-white/92 p-8 shadow-[0_32px_80px_rgba(15,23,42,0.14)] backdrop-blur">
        <MaintainProLogo showTagline size="md" />

        <header className="mt-6">
          <h1 className="text-3xl font-semibold text-slate-900">Forgot password?</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{PRODUCT_TAGLINE}</p>
        </header>

        <p className="mt-4 text-sm leading-6 text-slate-500">
          Enter your work email. If an account exists, a reset link request will be accepted.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-sm text-slate-600">
            <span className="mb-2 block font-medium text-slate-700">Work Email</span>
            <input
              {...register("email")}
              autoComplete="email"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
              type="email"
            />
          </label>
          <button
            className="min-h-11 w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={busy}
            type="submit"
          >
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 aria-hidden className="animate-spin" size={16} />
                Sending...
              </span>
            ) : (
              "Send reset link"
            )}
          </button>
        </form>

        {sent ? (
          <p
            className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            role="status"
          >
            If the email exists, a reset link request has been accepted.
          </p>
        ) : null}

        <p className="mt-6 text-sm text-slate-500">
          Return to{" "}
          <a
            className="font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
            href="/login"
          >
            Sign in
          </a>
        </p>
      </section>
    </main>
  );
}
