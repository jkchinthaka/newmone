"use client";

import Link from "next/link";
import type { Route } from "next";
import { Suspense, FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { acceptInvite, verifyInviteToken } from "@/lib/people-api";
import { getApiErrorMessage } from "@/lib/api-client";

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const verifyQuery = useQuery({
    queryKey: ["invite-verify", token],
    queryFn: () => verifyInviteToken(token),
    enabled: Boolean(token.trim()),
    retry: false
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvite(token, password),
    onSuccess: () => toast.success("Password set — you can sign in now."),
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not accept invitation"))
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    acceptMutation.mutate();
  };

  if (!token.trim()) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6 text-center">
        <h1 className="text-xl font-semibold">Invalid invitation link</h1>
        <Link href={"/login" as Route} className="text-sm underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Set your password</h1>
      {verifyQuery.isLoading ? <p className="mt-2 text-sm text-slate-500">Verifying invitation…</p> : null}
      {verifyQuery.isError ? (
        <p className="mt-2 text-sm text-red-600">{getApiErrorMessage(verifyQuery.error, "Invitation invalid")}</p>
      ) : null}
      {verifyQuery.data ? (
        <p className="mt-2 text-sm text-slate-600">
          {verifyQuery.data.fullName} · {verifyQuery.data.email}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={acceptMutation.isPending || verifyQuery.isError}
          className="w-full rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Activate account
        </button>
      </form>
      <Link href={"/login" as Route} className="mt-4 block text-center text-sm underline">
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
