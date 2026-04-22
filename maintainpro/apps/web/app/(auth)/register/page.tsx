"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { AxiosError } from "axios";
import { Loader2, UserPlus } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { setAuthSession } from "@/lib/auth-storage";

type RegisterForm = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const router = useRouter();
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
        password: values.password
      });
      const payload = res.data?.data;

      setAuthSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user
      });

      window.location.replace("/home");
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const message = Array.isArray(raw) ? raw.join(", ") : raw;
      setError(message ?? "Registration failed. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(20,118,214,0.16),_transparent_40%),linear-gradient(135deg,#f7fafc,#e2ebf5)] p-6">
      <section className="w-full max-w-2xl rounded-[32px] border border-white/60 bg-white/92 p-8 shadow-[0_32px_80px_rgba(15,23,42,0.14)] backdrop-blur xl:p-10">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <UserPlus size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Create Access</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Registration</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-500">New web accounts default to the technician workflow until an administrator changes the assigned role.</p>

        <form className="mt-8 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <label className="text-sm text-slate-600"><span className="mb-2 block">User ID</span><input {...register("userId")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" type="text" /></label>
          <label className="text-sm text-slate-600"><span className="mb-2 block">Email</span><input {...register("email")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" type="email" /></label>
          <label className="text-sm text-slate-600"><span className="mb-2 block">First Name</span><input {...register("firstName")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" type="text" /></label>
          <label className="text-sm text-slate-600"><span className="mb-2 block">Last Name</span><input {...register("lastName")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" type="text" /></label>
          <label className="text-sm text-slate-600"><span className="mb-2 block">Password</span><input {...register("password")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" type="password" /></label>
          <label className="text-sm text-slate-600"><span className="mb-2 block">Confirm Password</span><input {...register("confirmPassword")} className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" type="password" /></label>

          <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
            <p className="text-sm text-slate-500">Already have an account? <a href="/login" className="font-medium text-brand-700 hover:text-brand-800">Login</a></p>
            <button className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700" type="submit">
              {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Registering...</span> : "REGISTER"}
            </button>
          </div>

          {error ? <p className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
