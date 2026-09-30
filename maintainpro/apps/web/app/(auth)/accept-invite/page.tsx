"use client";

import Link from "next/link";
import type { Route } from "next";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getApiErrorMessage } from "@/lib/api-client";
import { acceptInvite, verifyInviteToken } from "@/lib/people-api";

const passwordRule = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [invitee, setInvitee] = useState<{ fullName: string; email: string } | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token.trim()) return;
    let cancelled = false;
    setVerifyState("loading");
    verifyInviteToken(token)
      .then((data) => {
        if (cancelled) return;
        setInvitee({ fullName: data.fullName, email: data.email });
        setVerifyState("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setVerifyMessage(getApiErrorMessage(error, "Invitation invalid"));
        setVerifyState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordRule.test(password)) {
      setFormError("Use at least 8 characters, with one uppercase letter, one number, and one special character.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      await acceptInvite(token, password);
      setAccepted(true);
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not accept invitation"));
    } finally {
      setBusy(false);
    }
  };

  if (!token.trim()) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6 text-center">
        <h1 className="text-xl font-semibold">Invalid invitation link</h1>
        <p className="text-sm text-slate-600">This link is missing its invitation token.</p>
        <Link href={"/login" as Route} className="inline-flex min-h-11 items-center text-sm underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Set your password</h1>
      {verifyState === "loading" ? <p className="mt-2 text-sm text-slate-500">Verifying invitation…</p> : null}
      {verifyState === "error" ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {verifyMessage}
        </p>
      ) : null}
      {invitee ? (
        <p className="mt-2 text-sm text-slate-600">
          {invitee.fullName} · {invitee.email}
        </p>
      ) : null}
      {accepted ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          Your account is active. Sign in with the password you just chose.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <label className="block text-sm" htmlFor="invite-password">
            <span className="mb-1.5 block font-medium text-slate-700">New password</span>
            <input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm" htmlFor="invite-password-confirm">
            <span className="mb-1.5 block font-medium text-slate-700">Confirm password</span>
            <input
              id="invite-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {formError ? (
            <p className="text-sm text-rose-700" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || verifyState === "error"}
            className="min-h-11 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy ? "Activating…" : "Activate account"}
          </button>
        </form>
      )}
      <Link href={"/login" as Route} className="mt-4 inline-flex min-h-11 items-center justify-center text-sm underline">
        Back to login
      </Link>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-slate-500">Loading invitation…</div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
