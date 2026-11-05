"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";

import { apiClient } from "@/lib/api-client";

interface Card {
  label: string;
  description: string;
  href: string;
  /** API path that returns the list, used only to show a count. */
  countFrom?: string;
}

const GROUPS: { title: string; cards: Card[] }[] = [
  {
    title: "People",
    cards: [
      { label: "Employees & technicians", description: "Staff records, with or without a login.", href: "/master-data/employees" },
      { label: "Drivers", description: "Licensed operators for vehicles.", href: "/fleet" },
      { label: "Requester groups", description: "Groups of people who raise requests.", href: "/master-data/requester-groups", countFrom: "/master-data/requester-groups" },
      { label: "Skills & trades", description: "Electrician, welder, plumber... for assigning jobs.", href: "/master-data/skills", countFrom: "/master-data/lists/skill" },
    ],
  },
  {
    title: "Assets & vehicles",
    cards: [
      { label: "Assets", description: "Machinery, equipment, infrastructure.", href: "/assets" },
      { label: "Vehicles", description: "Fleet with make, model, registration.", href: "/vehicles" },
      { label: "Meters", description: "Odometers, hour-meters, fuel gauges.", href: "/utilities" },
      { label: "Makes", description: "Vehicle manufacturers to pick instead of typing.", href: "/master-data/makes", countFrom: "/master-data/lists/make" },
    ],
  },
  {
    title: "Parts & stores",
    cards: [
      { label: "Spare parts", description: "Catalogue, stock levels, reorder alerts.", href: "/inventory" },
      { label: "Part categories", description: "The list every new part picks from.", href: "/master-data/part-categories", countFrom: "/master-data/part-categories" },
      { label: "Suppliers", description: "Vendors with categories and terms.", href: "/master-data/suppliers" },
      { label: "Units of measure", description: "pcs, litre, kg, metre for parts and fuel.", href: "/master-data/units", countFrom: "/master-data/lists/unit" },
    ],
  },
  {
    title: "Company & jobs",
    cards: [
      { label: "Departments", description: "Teams and cost centres.", href: "/master-data/departments" },
      { label: "Job codes", description: "Main jobs and sub-jobs used across all jobs.", href: "/maintenance/job-codes" },
      { label: "Work calendar", description: "Shifts, weekends and holidays for due dates.", href: "/master-data/work-calendar", countFrom: "/master-data/work-calendar" },
    ],
  },
];

export default function MasterDataPage() {
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const sources = GROUPS.flatMap((g) => g.cards).filter((c) => c.countFrom);
    void Promise.all(
      sources.map((c) =>
        apiClient
          .get<{ data: unknown[] }>(c.countFrom!)
          .then((res) => [c.href, Array.isArray(res.data.data) ? res.data.data.length : undefined] as const)
          .catch(() => [c.href, undefined] as const),
      ),
    ).then((pairs) => {
      const next: Record<string, number> = {};
      for (const [href, n] of pairs) if (n !== undefined) next[href] = n;
      setCounts(next);
    });
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      cards: g.cards.filter((c) => `${c.label} ${c.description}`.toLowerCase().includes(q)),
    })).filter((g) => g.cards.length > 0);
  }, [query]);

  return (
    <div className="space-y-2 p-6">
      <header>
        <h1 className="page-title">Master data</h1>
        <p className="mt-1 text-sm text-slate-500">The lists everything else picks from. Add them here first.</p>
      </header>

      <div className="relative max-w-md pt-3">
        <Search size={14} className="pointer-events-none absolute left-3 top-[1.65rem] text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search master data"
          aria-label="Search master data"
          className="min-h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm"
        />
      </div>

      {groups.length === 0 ? <p className="pt-4 text-sm text-slate-500">Nothing matches &quot;{query}&quot;.</p> : null}

      {groups.map((group) => (
        <section key={group.title} className="pt-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {group.cards.map((card) => (
              <Link
                key={card.href}
                href={card.href as Route}
                className="relative flex min-h-[84px] flex-col rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
              >
                <span className="pr-8 text-sm font-semibold text-slate-900">{card.label}</span>
                {counts[card.href] !== undefined ? (
                  <span className="absolute right-3 top-3 text-xs text-slate-400">{counts[card.href]}</span>
                ) : null}
                <span className="mt-1 text-xs leading-snug text-slate-500">{card.description}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
