"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MapPin, QrCode, Search } from "lucide-react";
import { toast } from "sonner";

import { QrScanner } from "@/components/qr/qr-scanner";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { createIdempotencyKey, withIdempotencyBody } from "@/lib/idempotency";
import { getBrowserNetworkState } from "@/lib/network-status";
import { enqueueOfflineAction } from "@/lib/offline-queue";
import {
  createMaintenanceRequest,
  listProblemCategories,
  type ProblemCategory
} from "@/lib/maintenance-requests-api";
import { listLocations, listSites, type OrgLocation, type OrgSite } from "@/lib/organization-api";
import type { Route } from "next";

type AssetHit = {
  id: string;
  assetTag: string;
  name: string;
  siteId?: string | null;
  functionalLocationId?: string | null;
};

type Step = 1 | 2 | 3 | 4 | 5 | 6;

function NewRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillTag = searchParams.get("assetTag") || searchParams.get("tag") || "";
  const prefillAssetId = searchParams.get("assetId") || "";

  const [step, setStep] = useState<Step>(1);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [assetQuery, setAssetQuery] = useState(prefillTag);
  const [assetHits, setAssetHits] = useState<AssetHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetHit | null>(null);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [locations, setLocations] = useState<OrgLocation[]>([]);
  const [siteId, setSiteId] = useState("");
  const [functionalLocationId, setFunctionalLocationId] = useState("");
  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const [problemCategoryId, setProblemCategoryId] = useState("");
  const [affectsOperation, setAffectsOperation] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [submitting, setSubmitting] = useState(false);
  const [pendingLocalId, setPendingLocalId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [cats, siteList] = await Promise.all([
          listProblemCategories(),
          listSites({ includeInactive: false })
        ]);
        setCategories(cats.items);
        setSites(siteList);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Unable to load form options."));
      }
    })();
  }, []);

  useEffect(() => {
    if (!siteId) {
      setLocations([]);
      return;
    }
    void (async () => {
      try {
        const locs = await listLocations({ siteId, includeInactive: false });
        setLocations(locs);
      } catch {
        setLocations([]);
      }
    })();
  }, [siteId]);

  const resolveAsset = useCallback(async (q: string) => {
    const query = q.trim();
    if (!query) {
      setAssetHits([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiClient.get("/assets", {
        params: { search: query, limit: 10 }
      });
      const data = (res.data as { data?: AssetHit[] }).data ?? [];
      setAssetHits(Array.isArray(data) ? data : []);
      const exact = data.find(
        (a) => a.assetTag?.toLowerCase() === query.toLowerCase() || a.id === query
      );
      if (exact) {
        setSelectedAsset(exact);
        if (exact.siteId) setSiteId(exact.siteId);
        if (exact.functionalLocationId) setFunctionalLocationId(exact.functionalLocationId);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Asset search failed."));
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (prefillAssetId) {
      void resolveAsset(prefillAssetId);
    } else if (prefillTag) {
      void resolveAsset(prefillTag);
    }
  }, [prefillAssetId, prefillTag, resolveAsset]);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === functionalLocationId) ?? null,
    [locations, functionalLocationId]
  );

  const canContinueTarget = Boolean(selectedAsset || functionalLocationId);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canContinueTarget) {
      toast.error("Select an asset or a functional location.");
      return;
    }
    if (description.trim().length < 5) {
      toast.error("Describe the problem (at least 5 characters).");
      return;
    }

    const idempotencyKey = createIdempotencyKey("mr-create");
    const payload = withIdempotencyBody(
      {
        assetId: selectedAsset?.id,
        functionalLocationId: functionalLocationId || undefined,
        siteId: siteId || undefined,
        problemCategoryId: problemCategoryId || undefined,
        description: description.trim(),
        affectsOperation,
        priority
      },
      idempotencyKey
    );

    const network = getBrowserNetworkState();
    if (network === "offline") {
      // Text-only draft — evidence/photos are not queued offline yet.
      const localActionId = createIdempotencyKey("mr-local");
      enqueueOfflineAction({
        localActionId,
        idempotencyKey,
        actionType: "MAINTENANCE_REQUEST_CREATE",
        entityType: "MaintenanceRequest",
        payload
      });
      setPendingLocalId(localActionId);
      toast.message("Saved offline as pending — will sync when online. Not submitted yet.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createMaintenanceRequest(payload);
      toast.success(`Request ${created.requestNumber} submitted`);
      router.push(`/requests/${created.id}` as Route);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Unable to submit request."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 md:p-6">
      <PageBreadcrumbs />
      <ResponsivePageHeader
        title="Report Issue"
        description="Fast maintenance reporting — asset or location, then describe the problem."
      />

      {pendingLocalId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Pending sync (local id {pendingLocalId.slice(0, 8)}…). Status is not Submitted until the
          server confirms.
        </div>
      ) : null}

      <div className="flex gap-1 text-xs text-slate-500">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-brand-500" : "bg-slate-200"}`}
          />
        ))}
      </div>

      {step === 1 ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">1. Find asset or location</h2>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm text-white"
            onClick={() => setScannerOpen(true)}
          >
            <QrCode size={16} /> Scan Asset QR
          </button>
          <div className="flex gap-2">
            <input
              className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Search asset tag or name"
              value={assetQuery}
              onChange={(e) => setAssetQuery(e.target.value)}
            />
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm"
              onClick={() => void resolveAsset(assetQuery)}
            >
              {searching ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
              Search
            </button>
          </div>
          {assetHits.length > 0 ? (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {assetHits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setSelectedAsset(hit);
                      if (hit.siteId) setSiteId(hit.siteId);
                      if (hit.functionalLocationId) setFunctionalLocationId(hit.functionalLocationId);
                    }}
                  >
                    <span className="font-medium">{hit.name}</span>
                    <span className="text-xs text-slate-500">{hit.assetTag}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="border-t border-slate-100 pt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <MapPin size={14} /> Or select location only
            </div>
            <select
              className="mb-2 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                setFunctionalLocationId("");
              }}
            >
              <option value="">Select site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            <select
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              value={functionalLocationId}
              onChange={(e) => setFunctionalLocationId(e.target.value)}
              disabled={!siteId}
            >
              <option value="">Select functional location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={!canContinueTarget}
            className="min-h-11 w-full rounded-lg bg-brand-600 text-sm font-medium text-white disabled:opacity-40"
            onClick={() => setStep(2)}
          >
            Continue
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">2. Confirm target</h2>
          {selectedAsset ? (
            <p className="text-sm">
              Asset: <strong>{selectedAsset.name}</strong> ({selectedAsset.assetTag})
            </p>
          ) : (
            <p className="text-sm text-slate-600">No asset — location-only report</p>
          )}
          {selectedLocation ? (
            <p className="text-sm">
              Location: <strong>{selectedLocation.name}</strong> ({selectedLocation.code})
            </p>
          ) : siteId ? (
            <p className="text-sm text-slate-500">Site selected; location optional if asset present</p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border px-3 text-sm" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              className="min-h-11 flex-1 rounded-lg bg-brand-600 text-sm text-white"
              onClick={() => setStep(3)}
            >
              Confirm
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">3. Problem category</h2>
          <select
            className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
            value={problemCategoryId}
            onChange={(e) => setProblemCategoryId(e.target.value)}
          >
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border px-3 text-sm" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="button"
              className="min-h-11 flex-1 rounded-lg bg-brand-600 text-sm text-white"
              onClick={() => setStep(4)}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">4. Is operation stopped?</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className={`min-h-11 flex-1 rounded-lg border text-sm ${affectsOperation ? "border-brand-500 bg-brand-50" : ""}`}
              onClick={() => setAffectsOperation(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className={`min-h-11 flex-1 rounded-lg border text-sm ${!affectsOperation ? "border-brand-500 bg-brand-50" : ""}`}
              onClick={() => setAffectsOperation(false)}
            >
              No
            </button>
          </div>
          <label className="block text-sm text-slate-600">
            Suggested urgency
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border px-3 text-sm" onClick={() => setStep(3)}>
              Back
            </button>
            <button
              type="button"
              className="min-h-11 flex-1 rounded-lg bg-brand-600 text-sm text-white"
              onClick={() => setStep(5)}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">5. Describe the problem</h2>
          <textarea
            className="min-h-32 w-full rounded-lg border border-slate-200 p-3 text-sm"
            placeholder="What happened? What do you see/hear?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
          />
          <p className="text-xs text-slate-500">
            Photos: attach after submit from request detail when online. Offline photo upload is not
            supported yet.
          </p>
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border px-3 text-sm" onClick={() => setStep(4)}>
              Back
            </button>
            <button
              type="button"
              className="min-h-11 flex-1 rounded-lg bg-brand-600 text-sm text-white"
              onClick={() => setStep(6)}
            >
              Review
            </button>
          </div>
        </section>
      ) : null}

      {step === 6 ? (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">6. Review & submit</h2>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="text-slate-500">Target</dt>
              <dd>
                {selectedAsset
                  ? `${selectedAsset.name} (${selectedAsset.assetTag})`
                  : selectedLocation?.name || "Location"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Category</dt>
              <dd>{categories.find((c) => c.id === problemCategoryId)?.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Operation stopped</dt>
              <dd>{affectsOperation ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Description</dt>
              <dd className="whitespace-pre-wrap">{description}</dd>
            </div>
          </dl>
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border px-3 text-sm" onClick={() => setStep(5)}>
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" size={14} /> : null}
              Submit Request
            </button>
          </div>
        </form>
      ) : null}

      <QrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(value) => {
          setScannerOpen(false);
          setAssetQuery(value);
          void resolveAsset(value);
          toast.success("QR scanned — searching asset…");
        }}
        title="Scan asset QR"
      />
    </div>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 p-6 text-slate-500">
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      }
    >
      <NewRequestForm />
    </Suspense>
  );
}
