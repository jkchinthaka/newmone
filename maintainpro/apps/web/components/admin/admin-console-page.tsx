"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { OperationalJobsHeader } from "@/components/operational";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { PermissionState } from "@/components/ui/page-state";
import { fetchAdminOverview } from "@/lib/admin-governance-api";
import { ADMIN_QUICK_ACTIONS, adminCommandGroups, isAdminConsoleRole, searchAdminModules } from "@/lib/admin-console";
import { apiClient } from "@/lib/api-client";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser, type CurrentUser } from "@/lib/use-current-user";

type UserHit = { id: string; email?: string | null; firstName?: string | null; lastName?: string | null };

function AdminConsoleAuthorized({ user, roleName }: { user: CurrentUser; roleName: string | null }) {
  const groups = adminCommandGroups(roleName);
  const daily = groups.filter((group) => !group.advanced);
  const advanced = groups.filter((group) => group.advanced);
  const [query, setQuery] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [userHits, setUserHits] = useState<UserHit[]>([]);
  const moduleHits = searchAdminModules(query, roleName);
  const overviewQuery = useQuery({
    queryKey: ["admin-governance", "overview"],
    queryFn: fetchAdminOverview,
    staleTime: 60_000,
    retry: false
  });
  const overview = overviewQuery.data;

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setUserHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void apiClient
        .get("/users", { signal: controller.signal, params: { q: term, pageSize: 5 } })
        .then((response) => {
          const payload = response.data?.data;
          const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
          if (!controller.signal.aborted) setUserHits(rows.slice(0, 5));
        })
        .catch(() => {
          if (!controller.signal.aborted) setUserHits([]);
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <>
      <OperationalJobsHeader
        eyebrow="Administration"
        title="Admin Console"
        description="Find a task, then open the exact setup screen. Access is still enforced by the API."
      />
      <label className="block text-sm" htmlFor="admin-search">
        <span className="sr-only">Search administration</span>
        <input
          id="admin-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search administration"
          className="h-10 w-full rounded-md border border-slate-300 px-3"
        />
      </label>
      {query.trim().length >= 2 ? (
        <div className="rounded-lg border border-slate-200 bg-white" aria-label="Search results">
          {moduleHits.map((section) => (
            <Link key={section.id} href={(section.href ?? "/admin") as never} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
              <span>
                <span className="font-medium">{section.title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{section.description}</span>
              </span>
              <span>Open</span>
            </Link>
          ))}
          {userHits.map((hit) => (
            <Link key={hit.id} href={"/admin/users" as never} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">User · {[hit.firstName, hit.lastName].filter(Boolean).join(" ") || "Account"}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{hit.email}</span>
              </span>
              <span>Open</span>
            </Link>
          ))}
          {moduleHits.length === 0 && userHits.length === 0 ? <p className="px-3 py-3 text-sm text-slate-600">No administration matches.</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {ADMIN_QUICK_ACTIONS.map((action) => (
          <Link key={action.id} href={action.href as never} className="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white">
            {action.label}
          </Link>
        ))}
      </div>
      <p className="text-sm text-slate-700" aria-label="Administration summary">
        Users {overview?.users.active ?? "–"} | Tenants {overview?.tenants?.active ?? "–"} | Open critical {overview?.jobs?.openCritical ?? "–"} | Overdue jobs {overview?.jobs?.overdue ?? "–"} | Data issues {overview?.dataQuality.totalIssues ?? "–"}
      </p>
      <p className="text-xs text-slate-500">Signed in as {user.email ?? "Unknown user"} · {roleName ?? "Unknown role"}</p>
      <h2 className="text-sm font-semibold text-slate-900">Administration modules</h2>
      {daily.map((group) => (
        <section key={group.id} aria-labelledby={`admin-${group.id}`}>
          <h2 id={`admin-${group.id}`} className="text-sm font-semibold text-slate-900">{group.title}</h2>
          <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {group.sections.map((section) => (
              <Link key={section.id} href={(section.href ?? "/admin") as never} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                <span>
                  <span className="font-medium text-slate-900">{section.title}</span>
                  <span className="block text-xs text-slate-500">{section.description}</span>
                </span>
                <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <section>
        <button type="button" className="text-sm font-semibold text-slate-900" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((value) => !value)}>
          Advanced settings {advancedOpen ? "▴" : "▾"}
        </button>
        {advancedOpen
          ? advanced.map((group) => (
              <div key={group.id} className="mt-2">
                <h2 className="text-sm font-medium text-slate-700">{group.title}</h2>
                <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {group.sections.map((section) => (
                    <Link key={section.id} href={(section.href ?? "/admin") as never} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                      <span>
                        <span className="font-medium">{section.title}</span>
                        <span className="block text-xs text-slate-500">{section.description}</span>
                      </span>
                      <span aria-hidden>→</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          : null}
      </section>
    </>
  );
}

export function AdminConsolePage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);

  return (
    <div className="ops-page">
      <PageBreadcrumbs />
      {!isAdmin ? (
        <PermissionState
          title="Admin access required"
          description="The admin console is available to ADMIN and SUPER_ADMIN roles only. Backend authorization still controls access to underlying modules."
        />
      ) : (
        <AdminConsoleAuthorized user={user} roleName={roleName} />
      )}
    </div>
  );
}
