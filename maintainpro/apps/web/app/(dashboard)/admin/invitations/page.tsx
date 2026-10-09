"use client";

import { Suspense } from "react";

import { AdminInvitationsPage } from "@/components/admin/admin-invitations-page";

export default function AdminInvitationsRoutePage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-slate-500">Loading invitations…</p>}>
      <AdminInvitationsPage />
    </Suspense>
  );
}
