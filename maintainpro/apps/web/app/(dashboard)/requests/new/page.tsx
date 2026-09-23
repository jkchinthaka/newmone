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
  type ProductionImpact,
  type ReportedUrgency,
  type SafetyImpact
} from "@/lib/maintenance-requests-api";
import { listLocations, listSites, type OrgLocation, type OrgSite } from "@/lib/organization-api";
import type { Route } from "next";

type TargetKind = "MACHINE" | "VEHICLE" | "FACILITY" | "NOT_SURE";

type AssetHit = {
  id: string;
  assetTag: string;
  name: string;
  serialNumber?: string | null;
  siteId?: string | null;
  functionalLocationId?: string | null;
};

type VehicleHit = {
  id: string;
  registrationNo: string;
  assetTag?: string | null;
  make: string;
  vehicleModel: string;
  assetId?: string | null;
};

type Step = 1 | 2 | 3 | 4 | 5;

function NewRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillTag = searchParams.get("assetTag") || searchParams.get("tag") || "";
  const prefillAssetId = searchParams.get("assetId") || "";

  const [step, setStep] = useState<Step>(1);
  const [targetKind, setTargetKind] = useState<TargetKind | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [assetQuery, setAssetQuery] = useState(prefillTag);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [assetHits, setAssetHits] = useState<AssetHit[]>([]);
  const [vehicleHits, setVehicleHits] = useState<VehicleHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetHit | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleHit | null>(null);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [locations, setLocations] = useState<OrgLocation[]>([]);
  const [siteId, setSiteId] = useState("");
  const [functionalLocationId, setFunctionalLocationId] = useState("");
  const [approximateLocation, setApproximateLocation] = useState("");
  const [description, setDescription] = useState("");
  const [reportedUrgency, setReportedUrgency] = useState<ReportedUrgency>("NORMAL");
  const [safetyImpact, setSafetyImpact] = useState<SafetyImpact>("NOT_SURE");
  const [productionImpact, setProductionImpact] = useState<ProductionImpact>("NOT_SURE");
  const [submitting, setSubmitting] = useState(false);
  const [pendingLocalId, setPendingLocalId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setSites(await listSites({ includeInactive: false }));
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Unable to load sites."));
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
        setLocations(await listLocations({ siteId, includeInactive: false }));
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
        (a) =>
          a.assetTag?.toLowerCase() === query.toLowerCase() ||
          a.serialNumber?.toLowerCase() === query.toLowerCase()
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

  const resolveVehicle = useCallback(async (q: string) => {
    const query = q.trim();
    if (!query) {
      setVehicleHits([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiClient.get("/vehicles", {
        params: { q: query, pageSize: 10 }
      });
      const payload = res.data as { data?: { items?: VehicleHit[] } | VehicleHit[] };
      const raw = payload.data;
      const data = Array.isArray(raw) ? raw : raw?.items ?? [];
      setVehicleHits(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Vehicle search failed."));
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (prefillAssetId || prefillTag) {
      setTargetKind("MACHINE");
      void resolveAsset(prefillAssetId || prefillTag);
    }
  }, [prefillAssetId, prefillTag, resolveAsset]);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === functionalLocationId) ?? null,
    [locations, functionalLocationId]
  );

  const targetSummary = useMemo(() => {
    if (targetKind === "MACHINE" && selectedAsset) {
      return `${selectedAsset.assetTag} — ${selectedAsset.name}`;
    }
    if (targetKind === "VEHICLE" && selectedVehicle) {
      const code = selectedVehicle.assetTag ? ` — ${selectedVehicle.assetTag}` : "";
      return `${selectedVehicle.registrationNo}${code} — ${selectedVehicle.make} ${selectedVehicle.vehicleModel}`;
    }
    if (targetKind === "FACILITY" && selectedLocation) {
      return `${selectedLocation.code} — ${selectedLocation.name}`;
    }
    if (targetKind === "NOT_SURE") {
      const site = sites.find((s) => s.id === siteId);
      return `Not sure${site ? ` · ${site.name}` : ""}${
        approximateLocation ? ` · ${approximateLocation}` : ""
      }`;
    }
    return null;
  }, [
    targetKind,
    selectedAsset,
    selectedVehicle,
    selectedLocation,
    sites,
    siteId,
    approximateLocation
  ]);

  const canContinueTarget = Boolean(
    (targetKind === "MACHINE" && selectedAsset) ||
      (targetKind === "VEHICLE" && selectedVehicle) ||
      (targetKind === "FACILITY" && functionalLocationId && siteId) ||
      (targetKind === "NOT_SURE" && siteId && approximateLocation.trim().length >= 3)
  );

  const chooseKind = (kind: TargetKind) => {
    setTargetKind(kind);
    setSelectedAsset(null);
    setSelectedVehicle(null);
    setFunctionalLocationId("");
    setApproximateLocation("");
    setAssetHits([]);
    setVehicleHits([]);
    setStep(2);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canContinueTarget || !targetKind) {
      toast.error("Identify what has a problem, or choose Not Sure with a site and area.");
      return;
    }
    if (description.trim().length < 5) {
      toast.error("Describe the problem (at least 5 characters).");
      return;
    }

    const idempotencyKey = createIdempotencyKey("mr-create");
    const payload = withIdempotencyBody(
      {
        assetId: targetKind === "MACHINE" ? selectedAsset?.id : undefined,
        vehicleId: targetKind === "VEHICLE" ? selectedVehicle?.id : undefined,
        functionalLocationId:
          targetKind === "FACILITY" ? functionalLocationId || undefined : undefined,
        siteId: siteId || undefined,
        targetUnresolved: targetKind === "NOT_SURE",
        approximateLocation:
          targetKind === "NOT_SURE" ? approximateLocation.trim() : undefined,
        description: description.trim(),
        reportedUrgency,
        safetyImpact,
        productionImpact
      },
      idempotencyKey
    );

    const network = getBrowserNetworkState();
    if (network === "offline") {
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
        description="Tell us what has a problem — machine, vehicle, facility, or not sure."
      />

      {pendingLocalId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Pending sync (local id {pendingLocalId.slice(0, 8)}…). Status is not Submitted until the
          server confirms.
        </div>
      ) : null}

      <div className="flex gap-1 text-xs text-slate-500">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-brand-500" : "bg-slate-200"}`}
          />
        ))}
      </div>

      {step === 1 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">What has a problem?</h2>
          {(
            [
              ["MACHINE", "Machine / Equipment"],
              ["VEHICLE", "Vehicle"],
              ["FACILITY", "Facility / Location"],
              ["NOT_SURE", "Not Sure"]
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-left text-sm hover:bg-slate-50"
              onClick={() => chooseKind(kind)}
            >
              {label}
            </button>
          ))}
        </section>
      ) : null}

      {step === 2 && targetKind === "MACHINE" ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Identify the machine</h2>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm"
            onClick={() => setScannerOpen(true)}
          >
            <QrCode size={16} /> Scan QR (optional shortcut)
          </button>
          <div className="flex gap-2">
            <input
              className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Search code, name, or serial"
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
                    className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      selectedAsset?.id === hit.id ? "bg-brand-50" : ""
                    }`}
                    onClick={() => {
                      setSelectedAsset(hit);
                      if (hit.siteId) setSiteId(hit.siteId);
                      if (hit.functionalLocationId) setFunctionalLocationId(hit.functionalLocationId);
                    }}
                  >
                    <span className="font-medium">
                      {hit.assetTag} — {hit.name}
                    </span>
                    {hit.serialNumber ? (
                      <span className="text-xs text-slate-500">Serial {hit.serialNumber}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selectedAsset ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              Selected: <strong>{selectedAsset.assetTag} — {selectedAsset.name}</strong>
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              disabled={!selectedAsset}
              className="min-h-11 flex-1 rounded-lg bg-brand-600 text-sm text-white disabled:opacity-40"
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 && targetKind === "VEHICLE" ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Identify the vehicle</h2>
          <div className="flex gap-2">
            <input
              className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Search registration, code, or name"
              value={vehicleQuery}
              onChange={(e) => setVehicleQuery(e.target.value)}
            />
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm"
              onClick={() => void resolveVehicle(vehicleQuery)}
            >
              {searching ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
              Search
            </button>
          </div>
          {vehicleHits.length > 0 ? (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {vehicleHits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      selectedVehicle?.id === hit.id ? "bg-brand-50" : ""
                    }`}
                    onClick={() => setSelectedVehicle(hit)}
                  >
                    <span className="font-medium">
                      {hit.registrationNo}
                      {hit.assetTag ? ` — ${hit.assetTag}` : ""} — {hit.make} {hit.vehicleModel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selectedVehicle ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              Selected:{" "}
              <strong>
                {selectedVehicle.registrationNo}
                {selectedVehicle.assetTag ? ` — ${selectedVehicle.assetTag}` : ""} —{" "}
                {selectedVehicle.make} {selectedVehicle.vehicleModel}
              </strong>
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              disabled={!selectedVehicle}
              className="min-h-11 flex-1 rounded-lg bg-brand-600 text-sm text-white disabled:opacity-40"
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 && targetKind === "FACILITY" ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Identify the location</h2>
          <div className="mb-1 flex items-center gap-2 text-sm text-slate-600">
            <MapPin size={14} /> Site + functional location
          </div>
          <select
            className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
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
                {l.code} — {l.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              disabled={!canContinueTarget}
              className="min-h-11 flex-1 rounded-lg bg-brand-600 text-sm text-white disabled:opacity-40"
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 && targetKind === "NOT_SURE" ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Where is the problem?</h2>
          <p className="text-sm text-slate-600">
            You do not need to know the exact equipment. A reviewer will confirm the target before
            any work order is created.
          </p>
          <select
            className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">Select site…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
          <textarea
            className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm"
            placeholder="Approximate area (building, room, yard, line…)"
            value={approximateLocation}
            onChange={(e) => setApproximateLocation(e.target.value)}
            maxLength={500}
          />
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              disabled={!canContinueTarget}
              className="min-h-11 flex-1 rounded-lg bg-brand-600 text-sm text-white disabled:opacity-40"
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Describe the problem</h2>
          {targetSummary ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              Target: <strong>{targetSummary}</strong>
            </p>
          ) : null}
          <textarea
            className="min-h-32 w-full rounded-lg border border-slate-200 p-3 text-sm"
            placeholder="What happened? What do you see or hear?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
          />
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="button"
              disabled={description.trim().length < 5}
              className="min-h-11 flex-1 rounded-lg bg-brand-600 text-sm text-white disabled:opacity-40"
              onClick={() => setStep(4)}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Urgency and impact</h2>
          <label className="block text-sm">
            How urgent does this feel?
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              value={reportedUrgency}
              onChange={(e) => setReportedUrgency(e.target.value as ReportedUrgency)}
            >
              <option value="NORMAL">Normal</option>
              <option value="URGENT">Urgent</option>
              <option value="VERY_URGENT">Very Urgent</option>
            </select>
          </label>
          <label className="block text-sm">
            Safety impact?
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              value={safetyImpact}
              onChange={(e) => setSafetyImpact(e.target.value as SafetyImpact)}
            >
              <option value="NO">No</option>
              <option value="YES">Yes</option>
              <option value="NOT_SURE">Not Sure</option>
            </select>
          </label>
          <label className="block text-sm">
            Production / business impact?
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              value={productionImpact}
              onChange={(e) => setProductionImpact(e.target.value as ProductionImpact)}
            >
              <option value="NONE">None</option>
              <option value="REDUCED">Reduced / Partial</option>
              <option value="STOPPED">Completely Stopped</option>
              <option value="NOT_SURE">Not Sure</option>
            </select>
          </label>
          <p className="text-xs text-slate-500">
            Maintenance staff set the official priority during review. Photos can be attached after
            submit when online.
          </p>
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setStep(3)}>
              Back
            </button>
            <button
              type="button"
              className="min-h-11 flex-1 rounded-lg bg-brand-600 text-sm text-white"
              onClick={() => setStep(5)}
            >
              Review
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Review & submit</h2>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="text-slate-500">Target</dt>
              <dd>{targetSummary || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Urgency</dt>
              <dd>
                {reportedUrgency === "NORMAL"
                  ? "Normal"
                  : reportedUrgency === "URGENT"
                    ? "Urgent"
                    : "Very Urgent"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Safety</dt>
              <dd>
                {safetyImpact === "YES" ? "Yes" : safetyImpact === "NO" ? "No" : "Not Sure"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Production impact</dt>
              <dd>
                {productionImpact === "NONE"
                  ? "None"
                  : productionImpact === "REDUCED"
                    ? "Reduced / Partial"
                    : productionImpact === "STOPPED"
                      ? "Completely Stopped"
                      : "Not Sure"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Description</dt>
              <dd className="whitespace-pre-wrap">{description}</dd>
            </div>
          </dl>
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setStep(4)}>
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
