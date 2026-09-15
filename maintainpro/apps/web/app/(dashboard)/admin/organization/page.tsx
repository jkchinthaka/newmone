"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { useCurrentUser } from "@/lib/use-current-user";
import { extractRoleName } from "@/lib/role-redirect";
import {
  FUNCTIONAL_LOCATION_TYPES,
  SITE_TYPES,
  createFunctionalLocation,
  createSite,
  fetchLocationTree,
  fetchOrganizationSummary,
  listSites,
  moveFunctionalLocation,
  runFacilityHierarchyMigration,
  updateFunctionalLocation,
  updateSite,
  type FunctionalLocationType,
  type LocationTreeNode,
  type OrgSite,
  type OrganizationSummary,
  type SiteType
} from "@/lib/organization-api";

function TreeRows({
  nodes,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedId
}: {
  nodes: LocationTreeNode[];
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: LocationTreeNode) => void;
  selectedId: string | null;
}) {
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isOpen = expanded.has(node.id);
        return (
          <div key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(node)}
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${
                selectedId === node.id ? "bg-brand-50 text-brand-900" : "hover:bg-slate-50"
              } ${node.isActive ? "" : "opacity-60"}`}
              style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
              {hasChildren ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex min-h-8 min-w-8 items-center justify-center"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(node.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggle(node.id);
                    }
                  }}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              ) : (
                <span className="inline-block min-w-8" />
              )}
              <span className="truncate font-medium">{node.name}</span>
              <span className="ml-auto shrink-0 text-[11px] uppercase tracking-wide text-slate-500">
                {node.type.replaceAll("_", " ")}
              </span>
            </button>
            {hasChildren && isOpen ? (
              <TreeRows
                nodes={node.children}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
                selectedId={selectedId}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export default function OrganizationAdminPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName({ role: user.role });
  const allowed = isAdminConsoleRole(roleName) || roleName === "FACILITY_MANAGER";

  const [summary, setSummary] = useState<OrganizationSummary | null>(null);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [tree, setTree] = useState<LocationTreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<LocationTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [siteForm, setSiteForm] = useState({
    code: "",
    name: "",
    type: "FACTORY" as SiteType,
    address: ""
  });
  const [childForm, setChildForm] = useState({
    code: "",
    name: "",
    type: "AREA" as FunctionalLocationType
  });
  const [moveParentId, setMoveParentId] = useState("");
  const [moveReason, setMoveReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, siteRows] = await Promise.all([
        fetchOrganizationSummary(),
        listSites({ includeInactive: true })
      ]);
      setSummary(summaryData);
      setSites(siteRows);
      if (!selectedSiteId && siteRows[0]) {
        setSelectedSiteId(siteRows[0].id);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load organization data."));
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId]);

  const loadTree = useCallback(async (siteId: string) => {
    try {
      const data = await fetchLocationTree(siteId, includeInactive);
      setTree(data.roots);
      setExpanded(new Set(data.roots.map((n) => n.id)));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Unable to load location tree."));
      setTree([]);
    }
  }, [includeInactive]);

  useEffect(() => {
    if (allowed) {
      void load();
    }
  }, [allowed, load]);

  useEffect(() => {
    if (selectedSiteId) {
      void loadTree(selectedSiteId);
      setSelectedNode(null);
    }
  }, [selectedSiteId, loadTree]);

  const flatNodes = useMemo(() => {
    const out: LocationTreeNode[] = [];
    const walk = (nodes: LocationTreeNode[]) => {
      for (const node of nodes) {
        out.push(node);
        walk(node.children);
      }
    };
    walk(tree);
    return out;
  }, [tree]);

  if (!allowed) {
    return (
      <ErrorState
        title="Organization administration"
        description="You do not have permission to manage organization sites and locations."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-slate-600">
        <Loader2 className="animate-spin" size={18} /> Loading organization…
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Organization" description={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6 pb-24 xl:pb-6">
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Organization" }
        ]}
      />

      <ResponsivePageHeader
        eyebrow="Master data"
        title="Organization & Locations"
        description="Sites and functional locations are the authoritative spatial foundation for maintenance. Backend tenancy remains Tenant-scoped; this UI shows Organization."
        actions={
          <Link
            href="/master-data/departments"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800"
          >
            Departments
          </Link>
        }
      />

      {summary ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Organization</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{summary.organization.name}</p>
            <p className="text-xs text-slate-500">{summary.organization.code}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sites</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {summary.counts.activeSites} / {summary.counts.sites}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Functional locations</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {summary.counts.functionalLocations}
            </p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Sites</h2>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              Show inactive locations
            </label>
          </div>

          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {sites.map((site) => (
              <li key={site.id}>
                <button
                  type="button"
                  onClick={() => setSelectedSiteId(site.id)}
                  className={`flex min-h-11 w-full flex-col rounded-lg px-3 py-2 text-left ${
                    selectedSiteId === site.id ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="text-sm font-medium text-slate-900">{site.name}</span>
                  <span className="text-xs text-slate-500">
                    {site.code} · {site.type}
                    {!site.isActive ? " · inactive" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <form
            className="space-y-2 border-t border-slate-100 pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                setBusy(true);
                try {
                  const created = await createSite(siteForm);
                  toast.success("Site created");
                  setSiteForm({ code: "", name: "", type: "FACTORY", address: "" });
                  await load();
                  setSelectedSiteId(created.id);
                } catch (err) {
                  toast.error(getApiErrorMessage(err, "Could not create site."));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add site</p>
            <input
              required
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="Code (e.g. FAC-01)"
              value={siteForm.code}
              onChange={(e) => setSiteForm((s) => ({ ...s, code: e.target.value }))}
            />
            <input
              required
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="Name"
              value={siteForm.name}
              onChange={(e) => setSiteForm((s) => ({ ...s, name: e.target.value }))}
            />
            <select
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              value={siteForm.type}
              onChange={(e) => setSiteForm((s) => ({ ...s, type: e.target.value as SiteType }))}
            >
              {SITE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Plus size={16} /> Create site
            </button>
          </form>

          <button
            type="button"
            disabled={busy}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800"
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const report = await runFacilityHierarchyMigration(true);
                  toast.message(
                    `Migration dry-run: properties ${String(report.propertiesMapped)}, buildings ${String(report.buildingsMapped)}, floors ${String(report.floorsMapped)}, rooms ${String(report.roomsMapped)}`
                  );
                } catch (err) {
                  toast.error(getApiErrorMessage(err, "Migration dry-run failed."));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Dry-run legacy facility migration
          </button>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Functional location tree</h2>
          {!selectedSiteId ? (
            <p className="text-sm text-slate-600">Select a site to manage its location hierarchy.</p>
          ) : (
            <>
              <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-slate-100 p-2">
                {tree.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">No locations yet. Add a root location below.</p>
                ) : (
                  <TreeRows
                    nodes={tree}
                    depth={0}
                    expanded={expanded}
                    selectedId={selectedNode?.id ?? null}
                    onToggle={(id) =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    onSelect={setSelectedNode}
                  />
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <form
                  className="space-y-2 rounded-lg border border-slate-100 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!selectedSiteId) return;
                    void (async () => {
                      setBusy(true);
                      try {
                        await createFunctionalLocation({
                          siteId: selectedSiteId,
                          parentId: selectedNode?.id ?? null,
                          ...childForm
                        });
                        toast.success(selectedNode ? "Child location created" : "Root location created");
                        setChildForm({ code: "", name: "", type: "AREA" });
                        await loadTree(selectedSiteId);
                        await load();
                      } catch (err) {
                        toast.error(getApiErrorMessage(err, "Could not create location."));
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Add {selectedNode ? `child under ${selectedNode.name}` : "root location"}
                  </p>
                  <input
                    required
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    placeholder="Code"
                    value={childForm.code}
                    onChange={(e) => setChildForm((s) => ({ ...s, code: e.target.value }))}
                  />
                  <input
                    required
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    placeholder="Name"
                    value={childForm.name}
                    onChange={(e) => setChildForm((s) => ({ ...s, name: e.target.value }))}
                  />
                  <select
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    value={childForm.type}
                    onChange={(e) =>
                      setChildForm((s) => ({ ...s, type: e.target.value as FunctionalLocationType }))
                    }
                  >
                    {FUNCTIONAL_LOCATION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-11 w-full rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Create location
                  </button>
                </form>

                {selectedNode ? (
                  <div className="space-y-2 rounded-lg border border-slate-100 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Selected: {selectedNode.code}
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      className="min-h-11 w-full rounded-lg border border-amber-300 px-3 text-sm text-amber-900"
                      onClick={() => {
                        void (async () => {
                          setBusy(true);
                          try {
                            await updateFunctionalLocation(selectedNode.id, {
                              isActive: !selectedNode.isActive
                            });
                            toast.success(
                              selectedNode.isActive ? "Location deactivated" : "Location reactivated"
                            );
                            if (selectedSiteId) await loadTree(selectedSiteId);
                          } catch (err) {
                            toast.error(getApiErrorMessage(err, "Could not update location."));
                          } finally {
                            setBusy(false);
                          }
                        })();
                      }}
                    >
                      {selectedNode.isActive ? "Deactivate location" : "Reactivate location"}
                    </button>

                    <label className="block text-xs text-slate-600">
                      Move under parent
                      <select
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                        value={moveParentId}
                        onChange={(e) => setMoveParentId(e.target.value)}
                      >
                        <option value="">(root)</option>
                        {flatNodes
                          .filter((n) => n.id !== selectedNode.id)
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.code} — {n.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <input
                      className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                      placeholder="Move reason (required)"
                      value={moveReason}
                      onChange={(e) => setMoveReason(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || moveReason.trim().length < 3}
                      className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-medium disabled:opacity-60"
                      onClick={() => {
                        void (async () => {
                          setBusy(true);
                          try {
                            await moveFunctionalLocation(selectedNode.id, {
                              parentId: moveParentId || null,
                              reason: moveReason.trim()
                            });
                            toast.success("Location moved");
                            setMoveReason("");
                            if (selectedSiteId) await loadTree(selectedSiteId);
                          } catch (err) {
                            toast.error(getApiErrorMessage(err, "Move failed."));
                          } finally {
                            setBusy(false);
                          }
                        })();
                      }}
                    >
                      Move location
                    </button>

                    {selectedSiteId ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                        onClick={() => {
                          const site = sites.find((s) => s.id === selectedSiteId);
                          if (!site) return;
                          void (async () => {
                            setBusy(true);
                            try {
                              await updateSite(site.id, { isActive: !site.isActive });
                              toast.success(site.isActive ? "Site deactivated" : "Site reactivated");
                              await load();
                            } catch (err) {
                              toast.error(getApiErrorMessage(err, "Could not update site."));
                            } finally {
                              setBusy(false);
                            }
                          })();
                        }}
                      >
                        Toggle site active
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
