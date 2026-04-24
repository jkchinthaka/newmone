"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2, ShieldCheck, Wrench } from "lucide-react";
import { AxiosError } from "axios";
import { apiClient } from "@/lib/api-client";
import { setAuthSession } from "@/lib/auth-storage";
import { setActiveTenantId } from "@/lib/tenant-context";

type LoginForm = {
  username: string;
  password: string;
};

function normalizeLogin(value: string) {
  const trimmed = value.trim();
  return trimmed.includes("@") ? trimmed : `${trimmed}@maintainpro.local`;
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit } = useForm<LoginForm>({
    defaultValues: {
      username: "admin",
      password: "Admin@1234"
    }
  });

  const onSubmit = async (values: LoginForm) => {
    setBusy(true);
    setError(null);

    try {
      const res = await apiClient.post("/auth/login", {
        email: normalizeLogin(values.username),
        password: values.password
      });
      const payload = res.data?.data;

      if (!payload?.accessToken) {
        setError("Login succeeded but token is missing from response.");
        return;
      }

      setAuthSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
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

      window.location.replace("/home");
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const message = Array.isArray(raw) ? raw.join(", ") : raw;
      setError(message ?? "Login failed. Check your credentials and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,118,214,0.16),_transparent_40%),linear-gradient(135deg,#f7fafc,#e2ebf5)] p-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between rounded-[32px] bg-gradient-to-br from-[#0f2b46] via-[#115ea8] to-[#b8860b] p-10 text-white shadow-[0_32px_80px_rgba(15,43,70,0.3)] lg:flex">
        <div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <Wrench size={24} />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Maintenance Job</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Fleet & Facility Maintenance Management System</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/82">
            Run pending requests, machinery jobs, service jobs, vehicle maintenance, costing, and completion workflows from one connected web workspace.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] border border-white/12 bg-white/10 p-4">
            <p className="text-sm font-medium">Role-aware dashboards</p>
            <p className="mt-2 text-sm text-white/72">Executives get view-only insight while operations roles can move jobs through the full lifecycle.</p>
          </div>
          <div className="rounded-[24px] border border-white/12 bg-white/10 p-4">
            <p className="text-sm font-medium">Full maintenance lifecycle</p>
            <p className="mt-2 text-sm text-white/72">Create jobs, allocate staff, estimate time, request items, and complete work with reporting.</p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center">
        <div className="w-full max-w-xl rounded-[32px] border border-white/60 bg-white/88 p-8 shadow-[0_32px_80px_rgba(15,23,42,0.14)] backdrop-blur xl:p-10">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">User Access</p>
              <h2 className="mt-1 text-3xl font-semibold text-slate-900">Login</h2>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-500">Use your assigned username or email to access the Maintenance Job workspace.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <label className="block text-sm">
              <span className="mb-2 block text-slate-600">Username</span>
              <input
                {...register("username")}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                type="text"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block text-slate-600">Password</span>
              <input
                {...register("password")}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                type="password"
              />
            </label>
            <div className="flex items-center justify-between gap-3 text-sm">
              <a href="/forgot-password" className="font-medium text-brand-700 hover:text-brand-800">Forgot Password?</a>
              <span className="text-slate-400">Sample admin: `admin` / `Admin@1234`</span>
            </div>
            <button className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700" type="submit">
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Signing in...
                </span>
              ) : (
                "LOGIN"
              )}
            </button>
            {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Don&apos;t have an account? <a href="/register" className="font-medium text-brand-700 hover:text-brand-800">Sign Up</a>
          </p>
        </div>
      </section>
    </main>
  );
}
