"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2, MailCheck } from "lucide-react";

import { apiClient } from "@/lib/api-client";

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
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <MailCheck size={22} />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Account Recovery</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Forgot Password?</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Enter your email and the backend will accept a reset request for your account.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-sm text-slate-600">
            <span className="mb-2 block">Email</span>
            <input {...register("email")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" type="email" />
          </label>
          <button className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700" type="submit">
            {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Sending...</span> : "Send Reset Link"}
          </button>
        </form>

        {sent ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">If the email exists, a reset link request has been accepted.</p> : null}

        <p className="mt-6 text-sm text-slate-500">Return to <a href="/login" className="font-medium text-brand-700 hover:text-brand-800">Login</a></p>
      </section>
    </main>
  );
}