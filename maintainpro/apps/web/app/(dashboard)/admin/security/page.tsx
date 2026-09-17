"use client";

import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

export default function AdminSecurityPage() {
  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Security Settings" }]} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Security Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Session, access, and audit controls. Browser JWTs stay compact — permissions are
          loaded from the database on each API request.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/admin/users" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Users & Access</h2>
          <p className="mt-1 text-sm text-slate-600">Disable, invite, and review user security status.</p>
        </Link>
        <Link href="/admin/roles" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Roles & Permissions</h2>
          <p className="mt-1 text-sm text-slate-600">Permission matrix and role coverage.</p>
        </Link>
        <Link href="/admin/audit" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Audit Log</h2>
          <p className="mt-1 text-sm text-slate-600">Security-relevant admin and override actions.</p>
        </Link>
        <Link href="/system-health" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">System Health</h2>
          <p className="mt-1 text-sm text-slate-600">API, database, Redis, and queue readiness.</p>
        </Link>
      </div>
    </div>
  );
}
