"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { apiClient } from "@/lib/api-client";
import { setAuthSession } from "@/lib/auth-storage";

type LoginForm = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit } = useForm<LoginForm>({
    defaultValues: {
      email: "admin@maintainpro.local",
      password: "Admin@1234"
    }
  });

  const onSubmit = async (values: LoginForm) => {
    setBusy(true);
    setError(null);

    try {
      const res = await apiClient.post("/auth/login", values);
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

      router.replace("/dashboard");
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
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-100 via-white to-slate-100 p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-brand-700">MaintainPro</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">Access your enterprise operations dashboard.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Email</span>
            <input
              {...register("email")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-400 focus:outline-none"
              type="email"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Password</span>
            <input
              {...register("password")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-400 focus:outline-none"
              type="password"
            />
          </label>
          <button className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700" type="submit">
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Signing in...
              </span>
            ) : (
              "Continue"
            )}
          </button>
          {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </form>
      </section>
    </main>
  );
}
