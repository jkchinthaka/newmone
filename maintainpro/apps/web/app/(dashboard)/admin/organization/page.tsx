"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, ChevronDown, ChevronRight, Ellipsis, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { PlacesExcelImport } from "@/components/organization/places-excel-import";
import { ActiveFilterChips } from "@/components/operational/active-filter-chips";
import { OperationalPageHeader } from "@/components/operational/operational-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { moveTargets } from "@/lib/places-import";
import { formatEnumLabel } from "@/lib/display-labels";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { useCurrentUser } from "@/lib/use-current-user";
import { EMPTY_SITE_GEO, siteGeoDraftFrom, siteGeoPayload, type SiteGeoDraft } from "@/lib/site-geo";
import { extractRoleName } from "@/lib/role-redirect";
import {
  FUNCTIONAL_LOCATION_TYPES,
  SITE_TYPES,
  createFunctionalLocation,
  createSite,
  fetchLocationChildren,
  fetchLocationTree,
  fetchOrganizationSummary,
  listLocations,
  listSitesPage,
  moveFunctionalLocation,
  runFacilityHierarchyMigration,
  updateFunctionalLocation,
  updateSite,
  type FunctionalLocationType,
  type OrgLocation,
  type OrgSite,
  type OrganizationSummary,
  type SiteType
} from "@/lib/organization-api";
import {
  DEPARTMENTS_HREF,
  ORG_LOCATIONS_EMPTY,
  ORG_SITES_EMPTY,
  organizationSearch,
  organizationStateFromSearch,
  rootLocationQuery
} from "@/lib/organization-workspace";

type Dialog =
  | { kind: "site"; site: OrgSite | null }
  | { kind: "location"; parent: OrgLocation | null; location: OrgLocation | null }
  | null;

function LocationBranch({
  nodes,
  depth,
  expanded,
  childrenById,
  selectedId,
  onToggle,
  onSelect,
  onMenu
}: {
  nodes: OrgLocation[];
  depth: number;
  expanded: Set<string>;
  childrenById: Record<string, OrgLocation[] | undefined>;
  selectedId: string;
  onToggle: (node: OrgLocation) => void;
  onSelect: (node: OrgLocation) => void;
  onMenu: (node: OrgLocation) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => {
        const open = expanded.has(node.id);
        const children = childrenById[node.id];
        const canExpand = (node.childCount ?? 0) > 0;
        return (
          <li key={node.id} id={`location-${node.id}`}>
            <div
              className={`flex min-h-10 items-center gap-1 rounded-md pr-1 text-sm ${selectedId === node.id ? "bg-brand-50 text-brand-950 ring-1 ring-brand-200" : "hover:bg-slate-50"} ${node.isActive ? "" : "opacity-70"}`}
              style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                aria-expanded={canExpand ? open : undefined}
                aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
                onClick={() => onToggle(node)}
              >
                {canExpand ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3" />}
              </button>
              <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect(node)}>
                <span className="font-medium">{node.name}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {node.code} · {formatEnumLabel(node.type)}
                  {(node.childCount ?? 0) > 0 ? ` · ${node.childCount} inside` : ""}
                  {node.isActive ? "" : " · Inactive"}
                </span>
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded"
                aria-label={`Actions for ${node.name}`}
                onClick={() => onMenu(node)}
              >
                <Ellipsis size={16} />
              </button>
            </div>
            {open && children ? (
              <LocationBranch
                nodes={children}
                depth={depth + 1}
                expanded={expanded}
                childrenById={childrenById}
                selectedId={selectedId}
                onToggle={onToggle}
                onSelect={onSelect}
                onMenu={onMenu}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function OrganizationAdminPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName({ role: user.role });
  const allowed = isAdminConsoleRole(roleName) || roleName === "FACILITY_MANAGER";
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlState = organizationStateFromSearch(params);

  const [summary, setSummary] = useState<OrganizationSummary | null>(null);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [locationSiteId, setLocationSiteId] = useState("");
  const [siteMeta, setSiteMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [roots, setRoots] = useState<OrgLocation[]>([]);
  const [childrenById, setChildrenById] = useState<Record<string, OrgLocation[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteQuery, setSiteQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [siteType, setSiteType] = useState<"" | SiteType>("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [more, setMore] = useState(false);
  const [tools, setTools] = useState(false);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menuSite, setMenuSite] = useState<OrgSite | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationHits, setLocationHits] = useState<OrgLocation[] | null>(null);
  const [siteDraft, setSiteDraft] = useState({ code: "", name: "", type: "FACTORY" as SiteType });
  const [siteGeo, setSiteGeo] = useState<SiteGeoDraft>(EMPTY_SITE_GEO);
  const [locating, setLocating] = useState(false);
  const [locationDraft, setLocationDraft] = useState({ code: "", name: "", type: "AREA" as FunctionalLocationType });
  const [moveParentId, setMoveParentId] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [moveOptions, setMoveOptions] = useState<Array<{ id: string; label: string; depth: number }> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [locationAssets, setLocationAssets] = useState<{ total: number; items: Array<{ id: string; assetTag: string; name: string; status: string }> } | "hidden" | null>(null);
  const isSuperAdmin = roleName === "SUPER_ADMIN";

  const selectedSiteId = urlState.siteId || null;
  const selectedLocationId = urlState.locationId;

  function openCreateSite() {
    setSiteDraft({ code: "", name: "", type: "FACTORY" });
    setSiteGeo(EMPTY_SITE_GEO);
    setDialog({ kind: "site", site: null });
  }

  function openCreateLocation(parent: OrgLocation | null = null) {
    // The site comes from the page selection, else the first site; the dialog lets the user change it.
    setLocationSiteId(selectedSiteId ?? sites[0]?.id ?? "");
    setLocationDraft({ code: "", name: "", type: "AREA" });
    setMoveParentId("");
    setMoveReason("");
    setDialog({ kind: "location", parent, location: null });
  }

  function writeUrl(siteId: string | null, locationId: string | null) {
    const next = organizationSearch(siteId, locationId);
    router.replace((next ? `${pathname}?${next}` : pathname) as Route);
  }

  async function loadSites(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, sitePage] = await Promise.all([
        fetchOrganizationSummary(),
        listSitesPage({
          q: appliedQuery,
          type: siteType || undefined,
          includeInactive,
          page: nextPage,
          pageSize: 25
        })
      ]);
      setSummary(summaryData);
      setSites(sitePage.items);
      setSiteMeta({ page: sitePage.meta.page, totalPages: sitePage.meta.totalPages, total: sitePage.meta.total });
      if (!urlState.siteId && sitePage.items[0]) {
        writeUrl(sitePage.items[0].id, null);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load organization data."));
    } finally {
      setLoading(false);
    }
  }

  async function loadRoots(siteId: string) {
    setTreeLoading(true);
    try {
      const query = rootLocationQuery(siteId);
      const rows = await listLocations({
        siteId: query.siteId,
        parentId: query.parentId,
        includeInactive,
        pageSize: 100
      });
      setRoots(rows);
      setChildrenById({});
      setExpanded(new Set());
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Unable to load locations."));
      setRoots([]);
    } finally {
      setTreeLoading(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => setAppliedQuery(siteQuery.trim()), 400);
    return () => window.clearTimeout(handle);
  }, [siteQuery]);

  useEffect(() => {
    if (allowed) void loadSites(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, appliedQuery, siteType, includeInactive, page]);

  useEffect(() => {
    if (selectedSiteId) void loadRoots(selectedSiteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId, includeInactive]);

  useEffect(() => {
    if (!selectedSiteId || locationSearch.trim().length < 2) {
      setLocationHits(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void listLocations({ siteId: selectedSiteId, q: locationSearch.trim(), includeInactive, pageSize: 50 })
        .then(setLocationHits)
        .catch(() => setLocationHits([]));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [includeInactive, locationSearch, selectedSiteId]);

  useEffect(() => {
    if (!selectedLocationId) return;
    const node = document.getElementById(`location-${selectedLocationId}`);
    node?.scrollIntoView({ block: "nearest" });
  }, [selectedLocationId, roots, expanded]);

  // Close the site menu on a click elsewhere or Escape.
  useEffect(() => {
    if (!menuSite) return;
    const onPointer = (event: PointerEvent) => {
      const row = (event.target as Element | null)?.closest?.("[data-site-row]");
      if (row?.getAttribute("data-site-row") !== menuSite.id) setMenuSite(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuSite(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuSite]);

  // Where a location can be moved: the site's top level or any other location of the site.
  useEffect(() => {
    if (dialog?.kind !== "location" || !dialog.location || !selectedSiteId) {
      setMoveOptions(null);
      return;
    }
    const movingId = dialog.location.id;
    let cancelled = false;
    void fetchLocationTree(selectedSiteId)
      .then((tree) => {
        if (!cancelled) setMoveOptions(moveTargets(tree.roots, movingId));
      })
      .catch(() => {
        if (!cancelled) setMoveOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dialog, selectedSiteId]);

  // F: assets at the selected location (people who cannot view assets simply do not see the box).
  useEffect(() => {
    if (!selectedLocationId) {
      setLocationAssets(null);
      return;
    }
    let cancelled = false;
    setLocationAssets(null);
    void apiClient
      .get("/assets", { params: { functionalLocationId: selectedLocationId, limit: 8, page: 1 } })
      .then((response) => {
        if (cancelled) return;
        const items = (response.data?.data ?? []) as Array<{ id: string; assetTag: string; name: string; status: string }>;
        const total = Number((response.data?.meta as { total?: number } | undefined)?.total ?? items.length);
        setLocationAssets({ total, items });
      })
      .catch(() => {
        if (!cancelled) setLocationAssets("hidden");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLocationId]);

  async function toggleNode(node: OrgLocation) {
    const next = new Set(expanded);
    if (next.has(node.id)) {
      next.delete(node.id);
      setExpanded(next);
      return;
    }
    next.add(node.id);
    setExpanded(next);
    if (childrenById[node.id]) return;
    try {
      const children = await fetchLocationChildren(node.id, includeInactive);
      setChildrenById((current) => ({ ...current, [node.id]: children }));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Unable to load child locations."));
    }
  }

  function useMyLocationForSite() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("This browser cannot read the location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setSiteGeo((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }));
      },
      () => {
        setLocating(false);
        toast.error("Could not read the location. Allow location for this site and try again, or type it in.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function saveSite() {
    const geo = siteGeoPayload(siteGeo);
    if (!geo.ok) {
      toast.error(geo.error);
      return;
    }
    try {
      if (dialog?.kind === "site" && dialog.site) {
        await updateSite(dialog.site.id, { ...siteDraft, ...geo.value });
        toast.success("Site updated");
      } else {
        const created = await createSite({ ...siteDraft, ...geo.value });
        toast.success("Site created");
        writeUrl(created.id, null);
      }
      setDialog(null);
      await loadSites(page);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not save the site."));
    }
  }

  async function saveLocation() {
    if (dialog?.kind !== "location") return;
    const siteId = dialog.location || dialog.parent ? selectedSiteId : locationSiteId || selectedSiteId;
    if (!siteId) {
      toast.error("Choose a site for this location. Add a site first if there is none.");
      return;
    }
    try {
      if (dialog.location) {
        const reason = moveReason.trim();
        const target = moveParentId === "__root" ? null : moveParentId;
        const moving = moveParentId !== "" && target !== (dialog.location.parentId ?? null);
        if (moving && reason.length < 3) {
          toast.error("Write why it is being moved (at least 3 characters).");
          return;
        }
        await updateFunctionalLocation(dialog.location.id, locationDraft);
        if (moving) {
          await moveFunctionalLocation(dialog.location.id, { parentId: target, reason });
        }
        toast.success("Location updated");
      } else {
        await createFunctionalLocation({
          siteId,
          parentId: dialog.parent?.id ?? null,
          ...locationDraft
        });
        toast.success(dialog.parent ? "Child location created" : "Location created");
      }
      setDialog(null);
      setChildrenById({});
      if (siteId !== selectedSiteId) writeUrl(siteId, null);
      else await loadRoots(siteId);
      await loadSites(page);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not save the location."));
    }
  }

  async function setSiteActive(site: OrgSite, isActive: boolean) {
    try {
      await updateSite(site.id, { isActive });
      toast.success(isActive ? "Site activated" : "Site deactivated");
      setMenuSite(null);
      await loadSites(page);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not update the site."));
    }
  }

  async function setLocationActive(location: OrgLocation, isActive: boolean) {
    try {
      await updateFunctionalLocation(location.id, { isActive });
      toast.success(isActive ? "Location activated" : "Location deactivated");
      if (selectedSiteId) await loadRoots(selectedSiteId);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not update the location."));
    }
  }

  if (!allowed) {
    return (
      <ErrorState
        title="Organization administration"
        description="You do not have permission to manage organization sites and locations."
      />
    );
  }

  if (error && !summary) {
    return <ErrorState title="Organization" description={error} onRetry={() => void loadSites(page)} />;
  }

  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? null;

  return (
    <div className="min-w-0 space-y-3 p-4 md:p-6">
      <PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Organization" }]} />
      <OperationalPageHeader
        eyebrow="Master data"
        title="Organization & Locations"
        description="Sites and the functional locations that belong to them."
        actions={
          <>
            <Link href={DEPARTMENTS_HREF as Route} className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium">
              Departments
            </Link>
            <button type="button" className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium" onClick={openCreateSite}>
              Add Site
            </button>
            <button
              type="button"
              className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => openCreateLocation(null)}
            >
              Add Location
            </button>
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet size={16} aria-hidden /> Upload from Excel
            </button>
            {/* Developer tool: only the technical Super Admin sees it. */}
            {isSuperAdmin ? (
              <button type="button" className="h-10 px-2 text-sm text-slate-500" aria-expanded={tools} onClick={() => setTools((current) => !current)}>
                More actions
              </button>
            ) : null}
          </>
        }
      />
      {tools && isSuperAdmin ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">Legacy facility migration</p>
          <p className="mt-1">Dry-run only. It reports how properties, buildings, floors, and rooms would map. It does not change records until a later apply step.</p>
          <button
            type="button"
            className="mt-2 h-9 rounded-md border border-amber-300 bg-white px-3 text-sm"
            onClick={() => {
              void (async () => {
                try {
                  const report = await runFacilityHierarchyMigration(true);
                  toast.message(`Migration dry-run: properties ${String(report.propertiesMapped)}, buildings ${String(report.buildingsMapped)}, floors ${String(report.floorsMapped)}, rooms ${String(report.roomsMapped)}`);
                } catch (err) {
                  toast.error(getApiErrorMessage(err, "Migration dry-run failed."));
                }
              })();
            }}
          >
            Dry-run legacy facility migration
          </button>
        </div>
      ) : null}

      <p className="text-sm text-slate-700">
        Organization: {summary?.organization.name ?? "…"} · Sites: {summary?.counts.sites ?? "…"} · Functional Locations: {summary?.counts.functionalLocations ?? "…"}
      </p>

      <section className="grid gap-3 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-end gap-2 border-b border-slate-200 p-3">
            <label className="min-w-[8rem] flex-1 text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Search</span>
              <input aria-label="Search sites" value={siteQuery} onChange={(event) => { setPage(1); setSiteQuery(event.target.value); }} className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Type</span>
              <select aria-label="Site type" value={siteType} onChange={(event) => { setPage(1); setSiteType(event.target.value as "" | SiteType); }} className="h-10 rounded-md border border-slate-300 px-2 text-sm">
                <option value="">All types</option>
                {SITE_TYPES.map((type) => <option key={type} value={type}>{formatEnumLabel(type)}</option>)}
              </select>
            </label>
            <button type="button" className="h-10 rounded-md border border-slate-300 px-3 text-sm" aria-expanded={more} onClick={() => setMore((current) => !current)}>More filters</button>
            <button type="button" className="h-10 px-2 text-sm font-medium text-brand-700" onClick={() => { setSiteQuery(""); setAppliedQuery(""); setSiteType(""); setIncludeInactive(false); setPage(1); }}>Clear</button>
          </div>
          {more ? (
            <label className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={includeInactive} onChange={(event) => { setPage(1); setIncludeInactive(event.target.checked); }} />
              Include inactive sites and locations
            </label>
          ) : null}
          <ActiveFilterChips
            chips={[
              appliedQuery ? { key: "q", label: appliedQuery } : null,
              siteType ? { key: "type", label: formatEnumLabel(siteType) } : null,
              includeInactive ? { key: "inactive", label: "Including inactive" } : null
            ].filter((chip): chip is { key: string; label: string } => Boolean(chip))}
            onRemove={(key) => {
              setPage(1);
              if (key === "q") { setSiteQuery(""); setAppliedQuery(""); }
              if (key === "type") setSiteType("");
              if (key === "inactive") setIncludeInactive(false);
            }}
            onClearAll={() => { setPage(1); setSiteQuery(""); setAppliedQuery(""); setSiteType(""); setIncludeInactive(false); }}
          />
          {loading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-slate-600"><Loader2 className="animate-spin" size={16} /> Loading sites</p>
          ) : sites.length === 0 ? (
            <div className="p-4 text-sm">
              <p>{appliedQuery || siteType || includeInactive ? "No sites match these filters." : ORG_SITES_EMPTY}</p>
              {appliedQuery || siteType || includeInactive ? null : <button type="button" className="mt-2 h-9 rounded-md bg-slate-900 px-3 text-sm text-white" onClick={openCreateSite}>Create Site</button>}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100" aria-label="Sites">
              {sites.map((site) => {
                const selected = site.id === selectedSiteId;
                return (
                  <li key={site.id} data-site-row={site.id} className={`relative flex items-stretch ${selected ? "bg-brand-50" : "hover:bg-slate-50"}`}>
                    <span aria-hidden className={`w-1 shrink-0 ${selected ? "bg-brand-600" : "bg-transparent"}`} />
                    <button
                      type="button"
                      aria-current={selected ? "true" : undefined}
                      onClick={() => writeUrl(site.id, null)}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`font-medium ${selected ? "text-brand-950" : "text-slate-900"}`}>{site.name}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{formatEnumLabel(site.type)}</span>
                        {site.isActive ? null : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">Inactive</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {site.code} · {site.locationCount ?? 0} location{site.locationCount === 1 ? "" : "s"}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Actions for ${site.name}`}
                      aria-expanded={menuSite?.id === site.id}
                      className="inline-flex w-11 shrink-0 items-center justify-center text-slate-600 hover:text-slate-900"
                      onClick={() => setMenuSite(menuSite?.id === site.id ? null : site)}
                    >
                      <Ellipsis size={18} />
                    </button>
                    {menuSite?.id === site.id ? (
                      <div role="menu" aria-label={`Actions for ${site.name}`} className="absolute right-2 top-full z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 text-slate-800 shadow-lg">
                        <button type="button" role="menuitem" className="block h-10 w-full rounded px-2 text-left text-sm hover:bg-slate-50" onClick={() => { setSiteDraft({ code: site.code, name: site.name, type: site.type }); setSiteGeo(siteGeoDraftFrom(site)); setDialog({ kind: "site", site }); setMenuSite(null); }}>Edit</button>
                        <button type="button" role="menuitem" className="block h-10 w-full rounded px-2 text-left text-sm hover:bg-slate-50" onClick={() => { writeUrl(site.id, null); openCreateLocation(null); setMenuSite(null); }}>Add location</button>
                        <button type="button" role="menuitem" className="block h-10 w-full rounded px-2 text-left text-sm hover:bg-slate-50" onClick={() => void setSiteActive(site, !site.isActive)}>{site.isActive ? "Deactivate" : "Activate"}</button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {siteMeta.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm">
              <button type="button" className="h-8 px-2" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <span>{siteMeta.page} / {siteMeta.totalPages}</span>
              <button type="button" className="h-8 px-2" disabled={page >= siteMeta.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Functional locations</h2>
              <p className="text-xs text-slate-500">{selectedSite ? selectedSite.name : "Select a site"}</p>
            </div>
            <label className="text-sm">
              <span className="sr-only">Search locations</span>
              <input
                aria-label="Search locations"
                value={locationSearch}
                placeholder="Search locations"
                className="h-10 rounded-md border border-slate-300 px-2 text-sm"
                onChange={(event) => setLocationSearch(event.target.value)}
              />
            </label>
          </div>
          {!selectedSiteId ? (
            <p className="text-sm text-slate-600">Select a site to see its locations.</p>
          ) : treeLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="animate-spin" size={16} /> Loading locations</p>
          ) : locationHits ? (
            <ul className="space-y-1 text-sm">
              {locationHits.length === 0 ? <li>{ORG_LOCATIONS_EMPTY}</li> : locationHits.map((row) => (
                <li key={row.id}>
                  <button type="button" className="min-h-10 w-full rounded px-2 text-left hover:bg-slate-50" onClick={() => writeUrl(selectedSiteId, row.id)}>
                    {row.name} <span className="text-xs text-slate-500">{row.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : roots.length === 0 ? (
            <div className="text-sm">
              <p>{ORG_LOCATIONS_EMPTY}</p>
              <button type="button" className="mt-2 h-9 rounded-md bg-slate-900 px-3 text-sm text-white" onClick={() => openCreateLocation(null)}>Add Location</button>
            </div>
          ) : (
            <LocationBranch
              nodes={roots}
              depth={0}
              expanded={expanded}
              childrenById={childrenById}
              selectedId={selectedLocationId}
              onToggle={(node) => void toggleNode(node)}
              onSelect={(node) => writeUrl(selectedSiteId, node.id)}
              onMenu={(node) => {
                setLocationDraft({ code: node.code, name: node.name, type: node.type });
                setMoveParentId("");
                setMoveReason("");
                setDialog({ kind: "location", parent: null, location: node });
                writeUrl(selectedSiteId, node.id);
              }}
            />
          )}
          {selectedLocationId && locationAssets !== "hidden" ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm" aria-live="polite">
              <p className="flex items-center gap-2 font-medium text-slate-900">
                <Boxes size={16} aria-hidden /> Assets here
                <span className="text-slate-500">{locationAssets ? `(${locationAssets.total})` : "…"}</span>
              </p>
              {locationAssets && locationAssets.items.length ? (
                <ul className="mt-2 space-y-1">
                  {locationAssets.items.map((asset) => (
                    <li key={asset.id}>
                      <Link href={`/assets?asset=${encodeURIComponent(asset.id)}` as Route} className="flex min-h-9 items-center gap-2 rounded px-1 hover:bg-white">
                        <span className="font-mono text-xs text-slate-600">{asset.assetTag}</span>
                        <span className="truncate text-slate-900">{asset.name}</span>
                        <span className="ml-auto text-xs text-slate-500">{formatEnumLabel(asset.status)}</span>
                      </Link>
                    </li>
                  ))}
                  {locationAssets.total > locationAssets.items.length ? (
                    <li className="px-1 text-xs text-slate-500">and {locationAssets.total - locationAssets.items.length} more</li>
                  ) : null}
                </ul>
              ) : locationAssets ? (
                <p className="mt-1 text-xs text-slate-500">No assets at this location yet.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>


      {dialog?.kind === "site" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="presentation">
          <form role="dialog" aria-modal="true" aria-labelledby="site-dialog-title" className="max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-xl bg-white p-4" onSubmit={(event) => { event.preventDefault(); void saveSite(); }}>
            <h2 id="site-dialog-title" className="text-base font-semibold">{dialog.site ? "Edit site" : "Add site"}</h2>
            <label className="block text-sm">Code<input required value={siteDraft.code} onChange={(event) => setSiteDraft((current) => ({ ...current, code: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" /></label>
            <label className="block text-sm">Name<input required value={siteDraft.name} onChange={(event) => setSiteDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" /></label>
            <label className="block text-sm">Type
              <select value={siteDraft.type} onChange={(event) => setSiteDraft((current) => ({ ...current, type: event.target.value as SiteType }))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2">
                {SITE_TYPES.map((type) => <option key={type} value={type}>{formatEnumLabel(type)}</option>)}
              </select>
            </label>
            <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-sm font-medium">Site location (optional)</legend>
              <p className="text-xs text-slate-500">Used to flag job photos taken far from this site. Stand at the site and tap the button, or type it in.</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">Latitude<input inputMode="decimal" value={siteGeo.latitude} onChange={(event) => setSiteGeo((current) => ({ ...current, latitude: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" placeholder="6.8412" /></label>
                <label className="block text-sm">Longitude<input inputMode="decimal" value={siteGeo.longitude} onChange={(event) => setSiteGeo((current) => ({ ...current, longitude: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" placeholder="80.0034" /></label>
              </div>
              <label className="block text-sm">Allowed distance (metres)<input inputMode="numeric" value={siteGeo.geoRadiusMeters} onChange={(event) => setSiteGeo((current) => ({ ...current, geoRadiusMeters: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" placeholder="500" /></label>
              <button type="button" disabled={locating} onClick={useMyLocationForSite} className="h-10 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-60">{locating ? "Reading location…" : "Use my current location"}</button>
            </fieldset>
            <div className="flex justify-end gap-2">
              <button type="button" className="h-10 px-3 text-sm" onClick={() => setDialog(null)}>Cancel</button>
              <button type="submit" className="h-10 rounded-lg bg-slate-900 px-3 text-sm text-white">Save</button>
            </div>
          </form>
        </div>
      ) : null}

      {dialog?.kind === "location" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="presentation">
          <form role="dialog" aria-modal="true" aria-labelledby="location-dialog-title" className="w-full max-w-md space-y-3 rounded-xl bg-white p-4" onSubmit={(event) => { event.preventDefault(); void saveLocation(); }}>
            <h2 id="location-dialog-title" className="text-base font-semibold">{dialog.location ? "Edit location" : dialog.parent ? `Add child under ${dialog.parent.name}` : "Add location"}</h2>
            {!dialog.location && !dialog.parent ? (
              sites.length > 0 ? (
                <label className="block text-sm">Site
                  <select required value={locationSiteId} onChange={(event) => setLocationSiteId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2">
                    <option value="" disabled>Choose a site</option>
                    {sites.map((site) => <option key={site.id} value={site.id}>{site.name} ({site.code})</option>)}
                  </select>
                </label>
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
                  Add a site first. Locations sit inside a site.{" "}
                  <button type="button" className="font-medium underline" onClick={() => { setDialog(null); openCreateSite(); }}>Add Site</button>
                </p>
              )
            ) : null}
            <label className="block text-sm">Code<input required value={locationDraft.code} onChange={(event) => setLocationDraft((current) => ({ ...current, code: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" /></label>
            <label className="block text-sm">Name<input required value={locationDraft.name} onChange={(event) => setLocationDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" /></label>
            <label className="block text-sm">Type
              <select value={locationDraft.type} onChange={(event) => setLocationDraft((current) => ({ ...current, type: event.target.value as FunctionalLocationType }))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2">
                {FUNCTIONAL_LOCATION_TYPES.map((type) => <option key={type} value={type}>{formatEnumLabel(type)}</option>)}
              </select>
            </label>
            {dialog.location ? (
              <>
                <label className="block text-sm">Where it sits
                  <select
                    value={moveParentId || (dialog.location.parentId ?? "__root")}
                    onChange={(event) => setMoveParentId(event.target.value)}
                    disabled={moveOptions === null}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2"
                  >
                    <option value="__root">Top level of {selectedSite?.name ?? "the site"}</option>
                    {(moveOptions ?? []).map((option) => (
                      <option key={option.id} value={option.id}>
                        {`${"\u00a0\u00a0".repeat(option.depth)}${option.depth ? "└ " : ""}Inside ${option.label}`}
                      </option>
                    ))}
                  </select>
                  {moveOptions === null ? <span className="text-xs text-slate-500">Loading locations…</span> : null}
                </label>
                {moveParentId && (moveParentId === "__root" ? null : moveParentId) !== (dialog.location.parentId ?? null) ? (
                  <label className="block text-sm">Why is it moving?<input value={moveReason} onChange={(event) => setMoveReason(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" placeholder="e.g. Machine room rebuilt inside Building B" /></label>
                ) : null}
                <button type="button" className="text-sm text-brand-700" onClick={() => dialog.location && openCreateLocation(dialog.location)}>Add child</button>
                <button type="button" className="ml-3 text-sm" onClick={() => dialog.location && void setLocationActive(dialog.location, !dialog.location.isActive)}>{dialog.location.isActive ? "Deactivate" : "Activate"}</button>
              </>
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="h-10 px-3 text-sm" onClick={() => setDialog(null)}>Cancel</button>
              <button type="submit" className="h-10 rounded-lg bg-slate-900 px-3 text-sm text-white">Save</button>
            </div>
          </form>
        </div>
      ) : null}
      {importOpen ? (
        <PlacesExcelImport
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setChildrenById({});
            void loadSites(page);
            if (selectedSiteId) void loadRoots(selectedSiteId);
          }}
        />
      ) : null}
    </div>
  );
}
