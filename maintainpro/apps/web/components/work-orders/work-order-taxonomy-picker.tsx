"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";

import {
  fetchWorkOrderTaxonomy,
  searchWorkOrderTaxonomy,
  type TaxonomySearchResult,
  type WorkOrderTaxonomyNode
} from "@/lib/work-order-taxonomy-api";

type Props = {
  value?: {
    categoryId?: string;
    typeId?: string;
    issueId?: string;
    pathLabel?: string;
  };
  onChange: (value: {
    categoryId?: string;
    typeId?: string;
    issueId?: string;
    pathLabel: string;
    node?: TaxonomySearchResult | WorkOrderTaxonomyNode;
  }) => void;
  allowTriage?: boolean;
};

export function WorkOrderTaxonomyPicker({ value, onChange, allowTriage = true }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TaxonomySearchResult[]>([]);
  const [categories, setCategories] = useState<WorkOrderTaxonomyNode[]>([]);

  useEffect(() => {
    void fetchWorkOrderTaxonomy({ level: "CATEGORY" }).then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchWorkOrderTaxonomy(trimmed, 20);
        setResults(rows);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  const quickChips = useMemo(
    () => categories.filter((item) => item.code !== "OTHER").slice(0, 4),
    [categories]
  );

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-sm text-slate-700">
        <span className="font-medium">Search category / type / issue</span>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try tyre, brake, wifi, water leak, cold room..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
          />
        </div>
      </label>

      {value?.pathLabel ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Selected: {value.pathLabel}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {quickChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() =>
              onChange({
                categoryId: chip.id,
                pathLabel: chip.name,
                node: chip
              })
            }
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {chip.name}
          </button>
        ))}
      </div>

      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Searching taxonomy...
          </div>
        ) : results.length > 0 ? (
          results.map((result) => (
            <button
              key={`${result.id}-${result.pathLabel}`}
              type="button"
              onClick={() =>
                onChange({
                  categoryId: result.categoryId,
                  typeId: result.typeId,
                  issueId: result.issueId,
                  pathLabel: result.pathLabel || result.name,
                  node: result
                })
              }
              className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <div className="font-medium text-slate-900">{result.pathLabel || result.name}</div>
              {result.matchedKeywords.length ? (
                <div className="text-xs text-slate-500">Matched: {result.matchedKeywords.join(", ")}</div>
              ) : null}
            </button>
          ))
        ) : query.trim() ? (
          <div className="px-3 py-4 text-sm text-slate-500">No taxonomy matches found.</div>
        ) : (
          <div className="px-3 py-4 text-sm text-slate-500">Type a problem description or keyword to search.</div>
        )}
      </div>

      {allowTriage ? (
        <button
          type="button"
          onClick={() =>
            onChange({
              pathLabel: "Not Sure / Triage → Need Triage Classification",
              categoryId: undefined,
              typeId: undefined,
              issueId: undefined
            })
          }
          className="w-full rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 hover:bg-amber-100"
        >
          Not sure? Submit to triage. A supervisor will classify it.
        </button>
      ) : null}
    </div>
  );
}
