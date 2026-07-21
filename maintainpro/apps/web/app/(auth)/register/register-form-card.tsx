"use client";

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
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export function RegisterFormCard() {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitationToken");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit } = useForm<RegisterForm>();

  const onSubmit = async (values: RegisterForm) => {
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
        ...(invitationToken ? { invitationToken } : {})
      });
      const payload = res.data?.data;

      if (!payload?.user) {
        setError("Registration failed. Please try again.");
        return;
      }

      setAuthSession({
        user: payload.user
      });

      window.location.replace(getPostLoginRedirect(payload.user));
    } catch (e) {
      setError(getApiErrorMessage(e, "Registration failed. Check your details and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(20,118,214,0.16),_transparent_40%),linear-gradient(135deg,#f7fafc,#e2ebf5)] p-6">
      <section className="w-full max-w-2xl rounded-[32px] border border-white/60 bg-white/92 p-8 shadow-[0_32px_80px_rgba(15,23,42,0.14)] backdrop-blur xl:p-10">
        <MaintainProLogo showTagline size="md" />

        <header className="mt-6">
          <h1 className="text-3xl font-semibold text-slate-900">
            {invitationToken ? "Accept invitation" : "Registration"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{PRODUCT_TAGLINE}</p>
        </header>

        <p className="mt-4 text-sm leading-6 text-slate-500">
          {invitationToken
            ? "You've been invited to join a MaintainPro workspace. Complete the form below using the email address your invitation was sent to."
            : "Access is by invitation only. If self-registration is disabled, ask your administrator for an invitation link."}
        </p>

        <form className="mt-8 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <label className="text-sm text-slate-600" htmlFor="register-user-id"><span className="mb-2 block">User ID</span><input {...register("userId")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" id="register-user-id" type="text" /></label>
          <label className="text-sm text-slate-600" htmlFor="register-email"><span className="mb-2 block">Email</span><input {...register("email")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" id="register-email" type="email" /></label>
          <label className="text-sm text-slate-600" htmlFor="register-first-name"><span className="mb-2 block">First Name</span><input {...register("firstName")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" id="register-first-name" type="text" /></label>
          <label className="text-sm text-slate-600" htmlFor="register-last-name"><span className="mb-2 block">Last Name</span><input {...register("lastName")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" id="register-last-name" type="text" /></label>
          <label className="text-sm text-slate-600" htmlFor="register-password"><span className="mb-2 block">Password</span><input {...register("password")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" id="register-password" type="password" /></label>
          <label className="text-sm text-slate-600" htmlFor="register-confirm-password"><span className="mb-2 block">Confirm Password</span><input {...register("confirmPassword")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" id="register-confirm-password" type="password" /></label>

          <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
            <p className="text-sm text-slate-500">Already have an account? <a href="/login" className="font-medium text-brand-700 hover:text-brand-800">Login</a></p>
            <button className="min-h-11 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700" type="submit">
              {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Registering...</span> : "REGISTER"}
            </button>
          </div>

          {error ? <p className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
