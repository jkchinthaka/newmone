"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { useCurrentUser } from "@/lib/use-current-user";
import { extractRoleName } from "@/lib/role-redirect";
import {
  createAssetCategory,
  createAssetDomain,
  createAssetType,
  listAssetCategories,
  listAssetDomains,
  listAssetTypes,
  seedAssetTaxonomyDefaults,
  updateAssetDomain,
  type AssetCategoryMaster,
  type AssetDomain,
  type AssetTypeMaster
} from "@/lib/asset-taxonomy-api";

export default function AssetMastersAdminPage() {
  const user = useCurrentUser();
  const role = extractRoleName({ role: user.role });
  const canAdmin = isAdminConsoleRole(role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domains, setDomains] = useState<AssetDomain[]>([]);
  const [categories, setCategories] = useState<AssetCategoryMaster[]>([]);
  const [types, setTypes] = useState<AssetTypeMaster[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [domainCode, setDomainCode] = useState("");
  const [domainName, setDomainName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [typeName, setTypeName] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const domainData = await listAssetDomains(true);
      setDomains(domainData.items);
      const domainId = selectedDomainId ?? domainData.items[0]?.id ?? null;
      setSelectedDomainId(domainId);
      const categoryData = await listAssetCategories(domainId ?? undefined, true);
      setCategories(categoryData.items);
      const categoryId =
        selectedCategoryId && categoryData.items.some((c) => c.id === selectedCategoryId)
          ? selectedCategoryId
          : categoryData.items[0]?.id ?? null;
      setSelectedCategoryId(categoryId);
      const typeData = await listAssetTypes(categoryId ?? undefined, true);
      setTypes(typeData.items);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load asset masters."));
    } finally {
      setLoading(false);
    }
  }, [selectedDomainId, selectedCategoryId]);

  useEffect(() => {
    if (canAdmin) {
      void refresh();
    }
  }, [canAdmin, refresh]);

  if (!canAdmin) {
    return <ErrorState title="Access denied" description="Admin role required for asset masters." />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumbs />
      <ResponsivePageHeader
        title="Asset Masters"
        description="Tenant-scoped Domain → Category → Type taxonomy for the universal asset registry."
        actions={
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white"
            onClick={async () => {
              try {
                const result = await seedAssetTaxonomyDefaults();
                toast.success(
                  `Seeded ${result.domainsCreated} domains, ${result.categoriesCreated} categories, ${result.typesCreated} types`
                );
                await refresh();
              } catch (err) {
                toast.error(getApiErrorMessage(err, "Request failed."));
              }
            }}
          >
            Seed defaults
          </button>
        }
      />

      {error ? <ErrorState title="Failed to load" description={error} /> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" size={16} /> Loading masters…
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Domains</h2>
          <ul className="mb-4 max-h-72 space-y-1 overflow-auto">
            {domains.map((domain) => (
              <li key={domain.id}>
                <button
                  type="button"
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm ${
                    selectedDomainId === domain.id ? "bg-brand-50 text-brand-900" : "hover:bg-slate-50"
                  } ${domain.isActive ? "" : "opacity-60"}`}
                  onClick={() => {
                    setSelectedDomainId(domain.id);
                    setSelectedCategoryId(null);
                  }}
                >
                  <span className="truncate font-medium">{domain.name}</span>
                  <span className="text-[11px] text-slate-500">{domain.code}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <input
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Code"
              value={domainCode}
              onChange={(e) => setDomainCode(e.target.value)}
            />
            <input
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Name"
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
            />
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm"
              onClick={async () => {
                try {
                  await createAssetDomain({ code: domainCode, name: domainName });
                  setDomainCode("");
                  setDomainName("");
                  toast.success("Domain created");
                  await refresh();
                } catch (err) {
                  toast.error(getApiErrorMessage(err, "Request failed."));
                }
              }}
            >
              <Plus size={16} /> Add domain
            </button>
            {selectedDomainId ? (
              <button
                type="button"
                className="min-h-11 w-full rounded-lg text-sm text-amber-700"
                onClick={async () => {
                  try {
                    await updateAssetDomain(selectedDomainId, { isActive: false });
                    toast.success("Domain deactivated");
                    await refresh();
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, "Request failed."));
                  }
                }}
              >
                Deactivate selected
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Categories</h2>
          <ul className="mb-4 max-h-72 space-y-1 overflow-auto">
            {categories.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm ${
                    selectedCategoryId === category.id ? "bg-brand-50 text-brand-900" : "hover:bg-slate-50"
                  }`}
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  <span className="truncate font-medium">{category.name}</span>
                  <span className="text-[11px] text-slate-500">{category.code}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <input
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Code"
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
            />
            <input
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm"
              disabled={!selectedDomainId}
              onClick={async () => {
                if (!selectedDomainId) return;
                try {
                  await createAssetCategory({
                    domainId: selectedDomainId,
                    code: categoryCode,
                    name: categoryName
                  });
                  setCategoryCode("");
                  setCategoryName("");
                  toast.success("Category created");
                  await refresh();
                } catch (err) {
                  toast.error(getApiErrorMessage(err, "Request failed."));
                }
              }}
            >
              <Plus size={16} /> Add category
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Types</h2>
          <ul className="mb-4 max-h-72 space-y-1 overflow-auto">
            {types.map((type) => (
              <li key={type.id} className="rounded-lg px-3 py-2 text-sm">
                <div className="font-medium">{type.name}</div>
                <div className="text-[11px] text-slate-500">{type.code}</div>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <input
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Code"
              value={typeCode}
              onChange={(e) => setTypeCode(e.target.value)}
            />
            <input
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Name"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
            />
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm"
              disabled={!selectedCategoryId}
              onClick={async () => {
                if (!selectedCategoryId) return;
                try {
                  await createAssetType({
                    categoryId: selectedCategoryId,
                    code: typeCode,
                    name: typeName
                  });
                  setTypeCode("");
                  setTypeName("");
                  toast.success("Type created");
                  await refresh();
                } catch (err) {
                  toast.error(getApiErrorMessage(err, "Request failed."));
                }
              }}
            >
              <Plus size={16} /> Add type
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
