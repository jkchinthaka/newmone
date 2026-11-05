"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Car, CheckCircle2, HelpCircle, Loader2, MapPin, QrCode, Search, Wrench } from "lucide-react";
import { toast } from "sonner";

import { PendingPhotoPicker } from "@/components/requests/request-photos";
import { QrScanner } from "@/components/qr/qr-scanner";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ResponsivePageHeader } from "@/components/ui/responsive-page-header";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { createIdempotencyKey, withIdempotencyBody } from "@/lib/idempotency";
import { getRequestPhotoLimits, uploadRequestPhoto, DEFAULT_MAX_REQUEST_PHOTOS } from "@/lib/request-photos";
import { getBrowserNetworkState } from "@/lib/network-status";
import { enqueueOfflineAction } from "@/lib/offline-queue";
import { reportReviewSections, type ReportTargetKind } from "@/lib/report-issue-review";
import { getActiveTenantId } from "@/lib/tenant-context";
import { currentStoredUserId } from "@/lib/user-scoped-storage";
import {
  createMaintenanceRequest,
  listMaintenanceRequests,
  listRequestLocations,
  listRequestSites,
  type RequestLocationOption,
  type RequestSiteOption,
  type MaintenanceRequestListItem,
  type ProductionImpact,
  type ReportedUrgency,
  type SafetyImpact
} from "@/lib/maintenance-requests-api";
import {
  MACHINE_SEARCH_DEBOUNCE_MS,
  isCurrentMachineSearch,
  isCurrentSearch,
  machineForPrefill,
  machineLocationLabel,
  machineQueryRepresentsSelection,
  readMachineHits,
  shouldSearchMachines,
  type MachineHit
} from "@/lib/machine-search";

type TargetKind = "MACHINE" | "VEHICLE" | "FACILITY" | "NOT_SURE";

type AssetHit = MachineHit;

type VehicleHit = {
  id: string;
  registrationNo: string;
  assetTag?: string | null;
  make: string;
  vehicleModel: string;
  assetId?: string | null;
};

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS = ["Type", "Which one", "Describe", "Urgency", "Review"] as const;

const KIND_CARDS: ReadonlyArray<{ kind: TargetKind; label: string; hint: string; Icon: typeof Wrench }> = [
  { kind: "MACHINE", label: "Machine / Equipment", hint: "Pumps, tractors, tools, production equipment", Icon: Wrench },
  { kind: "VEHICLE", label: "Vehicle", hint: "Trucks, cars, bikes and other fleet vehicles", Icon: Car },
  { kind: "FACILITY", label: "Facility / Location", hint: "A building, room, road, water line or other place", Icon: MapPin },
  { kind: "NOT_SURE", label: "Not sure", hint: "Describe the area and a reviewer will find the right item", Icon: HelpCircle }
];

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={`min-h-11 rounded-lg border px-4 text-sm font-medium ${
                active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

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
  const [machineSearching, setMachineSearching] = useState(false);
  const [machineSearchMessage, setMachineSearchMessage] = useState<string | null>(null);
  const [machineSearchError, setMachineSearchError] = useState<string | null>(null);
  const machineSearchSeq = useRef(0);
  const machineSearchAbort = useRef<AbortController | null>(null);
  const vehicleSearchSeq = useRef(0);
  const vehicleSearchAbort = useRef<AbortController | null>(null);
  const selectedMachineQuery = useRef<string | null>(null);
  const userEditedMachineQuery = useRef(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetHit | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleHit | null>(null);
  const [sites, setSites] = useState<RequestSiteOption[]>([]);
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const [locations, setLocations] = useState<RequestLocationOption[]>([]);
  const [siteId, setSiteId] = useState("");
  const [functionalLocationId, setFunctionalLocationId] = useState("");
  const [approximateLocation, setApproximateLocation] = useState("");
  const [description, setDescription] = useState("");
  const [reportedUrgency, setReportedUrgency] = useState<ReportedUrgency>("NORMAL");
  const [safetyImpact, setSafetyImpact] = useState<SafetyImpact>("NOT_SURE");
  const [productionImpact, setProductionImpact] = useState<ProductionImpact>("NOT_SURE");
  const [submitting, setSubmitting] = useState(false);
  const [pendingLocalId, setPendingLocalId] = useState<string | null>(null);
  const [openMatches, setOpenMatches] = useState<MaintenanceRequestListItem[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoLimit, setPhotoLimit] = useState<{ enabled: boolean; maxPhotos: number } | null>(null);
  // One idempotency key per unchanged form, so a retry after a timeout cannot create a duplicate request.
  const submitKey = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setSites(await listRequestSites());
        setSitesLoaded(true);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Unable to load sites."));
      }
    })();
  }, []);

  useEffect(() => {
    void getRequestPhotoLimits()
      .then((limits) => setPhotoLimit({ enabled: limits.enabled, maxPhotos: limits.maxPhotos }))
      .catch(() => setPhotoLimit({ enabled: false, maxPhotos: DEFAULT_MAX_REQUEST_PHOTOS }));
  }, []);

  useEffect(() => {
    if (!siteId) {
      setLocations([]);
      return;
    }
    void (async () => {
      try {
        setLocations(await listRequestLocations(siteId));
      } catch {
        setLocations([]);
      }
    })();
  }, [siteId]);

  const chooseAsset = useCallback((hit: AssetHit, committedQuery: string) => {
    selectedMachineQuery.current = committedQuery.trim();
    setSelectedAsset(hit);
    if (hit.siteId) setSiteId(hit.siteId);
    if (hit.functionalLocationId) setFunctionalLocationId(hit.functionalLocationId);
  }, []);

  const searchMachines = useCallback(
    async (
      raw: string,
      options?: { selectPrefill?: boolean; assetId?: string }
    ) => {
      const query = raw.trim();
      const seq = ++machineSearchSeq.current;
      machineSearchAbort.current?.abort();
      const controller = new AbortController();
      machineSearchAbort.current = controller;
      if (!query && !options?.assetId) {
        setAssetHits([]);
        setMachineSearching(false);
        setMachineSearchMessage(null);
        setMachineSearchError(null);
        return;
      }
      setMachineSearching(true);
      setMachineSearchError(null);
      setMachineSearchMessage("Searching machines...");
      try {
        const res = await apiClient.get("/maintenance-requests/asset-lookup", {
          params: {
            ...(query ? { q: query } : {}),
            ...(options?.assetId ? { assetId: options.assetId } : {})
          },
          signal: controller.signal
        });
        if (!isCurrentMachineSearch(seq, machineSearchSeq.current)) return;
        const hits = readMachineHits(res.data);
        setAssetHits(hits);
        setMachineSearchMessage(hits.length === 0 ? "No matching machines found" : null);
        if (options?.selectPrefill) {
          const match = machineForPrefill(hits, options.assetId || query, true);
          if (match) {
            chooseAsset(match, match.assetTag);
            setAssetQuery(match.assetTag);
          }
        }
      } catch (err) {
        const canceled =
          (err as { code?: string; name?: string })?.code === "ERR_CANCELED" ||
          (err as { name?: string })?.name === "CanceledError";
        if (canceled || !isCurrentMachineSearch(seq, machineSearchSeq.current)) return;
        setAssetHits([]);
        setMachineSearchMessage(null);
        setMachineSearchError(getApiErrorMessage(err, "Asset search failed."));
      } finally {
        if (isCurrentMachineSearch(seq, machineSearchSeq.current)) setMachineSearching(false);
      }
    },
    [chooseAsset]
  );

  const resolveAsset = useCallback(
    async (q: string) => {
      await searchMachines(q, { selectPrefill: true });
    },
    [searchMachines]
  );

  const resolveVehicle = useCallback(async (q: string) => {
    const query = q.trim();
    const seq = ++vehicleSearchSeq.current;
    vehicleSearchAbort.current?.abort();
    const controller = new AbortController();
    vehicleSearchAbort.current = controller;
    if (!query) {
      setVehicleHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await apiClient.get("/maintenance-requests/vehicle-lookup", {
        params: { q: query },
        signal: controller.signal
      });
      if (!isCurrentSearch(seq, vehicleSearchSeq.current)) return;
      const payload = res.data as { data?: VehicleHit[] };
      setVehicleHits(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      const canceled =
        (err as { code?: string; name?: string })?.code === "ERR_CANCELED" ||
        (err as { name?: string })?.name === "CanceledError";
      if (canceled || !isCurrentSearch(seq, vehicleSearchSeq.current)) return;
      setVehicleHits([]);
      toast.error(getApiErrorMessage(err, "Vehicle search failed."));
    } finally {
      if (isCurrentSearch(seq, vehicleSearchSeq.current)) setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (prefillAssetId || prefillTag) {
      setTargetKind("MACHINE");
      setStep(2);
      void searchMachines(prefillTag, { selectPrefill: true, assetId: prefillAssetId || undefined });
    }
  }, [prefillAssetId, prefillTag, searchMachines]);

  useEffect(() => {
    if (step !== 2 || targetKind !== "MACHINE") return;
    if (!shouldSearchMachines(assetQuery)) {
      if (!userEditedMachineQuery.current && (prefillAssetId || prefillTag)) return;
      machineSearchSeq.current += 1;
      machineSearchAbort.current?.abort();
      setAssetHits([]);
      setMachineSearching(false);
      setMachineSearchMessage(null);
      setMachineSearchError(null);
      return;
    }
    if (machineQueryRepresentsSelection(assetQuery, selectedMachineQuery.current)) return;
    const handle = window.setTimeout(() => {
      if (machineQueryRepresentsSelection(assetQuery, selectedMachineQuery.current)) return;
      void searchMachines(assetQuery);
    }, MACHINE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [assetQuery, searchMachines, step, targetKind]);

  useEffect(() => {
    if (step !== 2 || targetKind !== "VEHICLE") return;
    if (!shouldSearchMachines(vehicleQuery)) {
      vehicleSearchSeq.current += 1;
      vehicleSearchAbort.current?.abort();
      setVehicleHits([]);
      setSearching(false);
      return;
    }
    const handle = window.setTimeout(() => {
      void resolveVehicle(vehicleQuery);
    }, MACHINE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [vehicleQuery, resolveVehicle, step, targetKind]);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === functionalLocationId) ?? null,
    [locations, functionalLocationId]
  );

  const reviewSections = reportReviewSections({
    targetKind: targetKind as ReportTargetKind | null,
    machineLabel: selectedAsset ? `${selectedAsset.assetTag} — ${selectedAsset.name}` : null,
    vehicleLabel: selectedVehicle
      ? `${selectedVehicle.registrationNo}${selectedVehicle.assetTag ? ` — ${selectedVehicle.assetTag}` : ""} — ${selectedVehicle.make} ${selectedVehicle.vehicleModel}`
      : null,
    siteName: (() => {
      const site = sites.find((s) => s.id === siteId);
      return site ? `${site.name} (${site.code})` : null;
    })(),
    locationLabel: selectedLocation ? `${selectedLocation.code} — ${selectedLocation.name}` : null,
    approximateLocation,
    description,
    reportedUrgency,
    safetyImpact,
    productionImpact
  });
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

  useEffect(() => {
    if (!selectedAsset?.id) {
      setOpenMatches([]);
      return;
    }
    let cancelled = false;
    void listMaintenanceRequests({ assetId: selectedAsset.id, openOnly: true, limit: 5 })
      .then((result) => {
        if (!cancelled) setOpenMatches(result.items);
      })
      .catch(() => {
        if (!cancelled) setOpenMatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAsset?.id]);

  const canContinueTarget = Boolean(
    (targetKind === "MACHINE" && selectedAsset) ||
      (targetKind === "VEHICLE" && selectedVehicle) ||
      (targetKind === "FACILITY" && functionalLocationId && siteId) ||
      (targetKind === "NOT_SURE" && (siteId || (sitesLoaded && sites.length === 0)) && approximateLocation.trim().length >= 3)
  );

  const continueHint = (() => {
    if (canContinueTarget) return null;
    if (targetKind === "MACHINE") return "Pick a machine from the results to continue.";
    if (targetKind === "VEHICLE") return "Pick a vehicle from the results to continue.";
    if (targetKind === "FACILITY") return !siteId ? "Choose a site, then a location." : "Choose a location to continue.";
    if (targetKind === "NOT_SURE") {
      if (!siteId && !(sitesLoaded && sites.length === 0)) return "Choose a site and describe the area (3+ characters).";
      return "Describe the area in at least 3 characters.";
    }
    return null;
  })();

  const chooseKind = (kind: TargetKind) => {
    if (kind === targetKind) {
      // Same type picked again: keep what the person already chose.
      setStep(2);
      return;
    }
    setTargetKind(kind);
    setSelectedAsset(null);
    selectedMachineQuery.current = null;
    setSelectedVehicle(null);
    // A site left over from another target type would clash with the new target's placement.
    setSiteId("");
    setFunctionalLocationId("");
    setApproximateLocation("");
    setAssetHits([]);
    setVehicleHits([]);
    setStep(2);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (submitting) return;
    if (!canContinueTarget || !targetKind) {
      toast.error("Identify what has a problem, or choose Not Sure with a site and area.");
      return;
    }
    if (description.trim().length < 5) {
      toast.error("Describe the problem (at least 5 characters).");
      return;
    }

    const body = {
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
    };
    const fingerprint = JSON.stringify(body);
    if (!submitKey.current || submitKey.current.fingerprint !== fingerprint) {
      submitKey.current = { fingerprint, key: createIdempotencyKey("mr-create") };
    }
    const idempotencyKey = submitKey.current.key;
    const payload = withIdempotencyBody(body, idempotencyKey);

    const network = getBrowserNetworkState();
    if (network === "offline") {
      const localActionId = createIdempotencyKey("mr-local");
      enqueueOfflineAction({
        localActionId,
        idempotencyKey,
        actionType: "MAINTENANCE_REQUEST_CREATE",
        entityType: "MaintenanceRequest",
        payload,
        ownerUserId: currentStoredUserId(),
        tenantId: getActiveTenantId()
      });
      setPendingLocalId(localActionId);
      toast.message(
        photos.length > 0
          ? "No internet. Saved on this device and it will be sent when you are back online. Photos are not saved offline, so add them on the request afterwards."
          : "No internet. Saved on this device and it will be sent automatically when you are back online."
      );
      return;
    }

    setSubmitting(true);
    try {
      const created = await createMaintenanceRequest(payload);
      let photoFailures = 0;
      if (photos.length > 0 && photoLimit?.enabled) {
        for (const file of photos) {
          const result = await uploadRequestPhoto(created.id, file);
          if (!result.ok) photoFailures += 1;
        }
      }
      if (photoFailures > 0) {
        toast.warning(`Request ${created.requestNumber} submitted, but ${photoFailures} photo${photoFailures === 1 ? "" : "s"} could not be added. Add them on the request page.`);
      } else {
        toast.success(`Request ${created.requestNumber} submitted`);
      }
      router.push(`/requests/${created.id}` as Route);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Unable to submit request."));
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingLocalId) {
    return (
      <div className="mx-auto max-w-xl space-y-6 p-4 md:p-6">
        <ResponsivePageHeader title="Report a problem" description="Saved on this device." />
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950" role="status">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={18} aria-hidden /> Saved on this device
          </div>
          <p className="text-sm">
            There is no internet right now, so the request has not been sent yet. It will be sent automatically when
            this device is back online and you are signed in (reference {pendingLocalId.slice(0, 8)}…).
          </p>
          <Link
            href={"/requests" as Route}
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white"
          >
            Go to Requests
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 md:p-6">
      <PageBreadcrumbs />
      <ResponsivePageHeader
        title="Report a problem"
        description="Tell us what is wrong. It takes about a minute."
      />

      <ol className="flex gap-1 text-xs" aria-label="Progress">
        {STEP_LABELS.map((label, index) => {
          const n = index + 1;
          return (
            <li key={label} className="flex-1" aria-current={step === n ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full ${step >= n ? "bg-brand-600" : "bg-slate-200"}`} />
              <span className={`mt-1 block truncate ${step === n ? "font-semibold text-slate-900" : "text-slate-500"}`}>{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">What has a problem?</h2>
          <div className="grid gap-2">
            {KIND_CARDS.map(({ kind, label, hint, Icon }) => (
              <button
                key={kind}
                type="button"
                className={`flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-slate-50 ${
                  targetKind === kind ? "border-brand-600 bg-brand-50" : "border-slate-200"
                }`}
                onClick={() => chooseKind(kind)}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-600">{hint}</span>
                </span>
              </button>
            ))}
          </div>
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
          <div className="flex min-w-0 gap-2">
            <input
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Search code, name, or serial"
              value={assetQuery}
              aria-label="Search machines"
              aria-autocomplete="list"
              aria-controls="machine-search-results"
              aria-expanded={assetHits.length > 0}
              onChange={(event) => {
                const next = event.target.value;
                userEditedMachineQuery.current = true;
                setAssetQuery(next);
                if (selectedAsset && !machineQueryRepresentsSelection(next, selectedMachineQuery.current)) {
                  selectedMachineQuery.current = null;
                  setSelectedAsset(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchMachines(assetQuery);
                }
              }}
            />
            <button
              type="button"
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm"
              onClick={() => void searchMachines(assetQuery)}
            >
              {machineSearching ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
              Search
            </button>
          </div>
          <div aria-live="polite" className="min-h-5 text-sm text-slate-600">
            {machineSearching ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={14} aria-hidden />
                Searching machines...
              </span>
            ) : null}
            {machineSearchError ? (
              <p role="alert" className="text-red-700">
                {machineSearchError}
              </p>
            ) : null}
            {!machineSearching && !machineSearchError && machineSearchMessage ? (
              <p>{machineSearchMessage}</p>
            ) : null}
          </div>
          {assetHits.length > 0 ? (
            <ul
              id="machine-search-results"
              role="listbox"
              aria-label="Matching machines"
              className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100"
            >
              {assetHits.map((hit) => {
                const location = machineLocationLabel(hit);
                const selected = selectedAsset?.id === hit.id;
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`flex min-h-11 w-full min-w-0 flex-col items-start break-words px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                        selected ? "bg-brand-50 ring-2 ring-inset ring-brand-600" : ""
                      }`}
                      onClick={() => chooseAsset(hit, assetQuery)}
                    >
                      <span className="font-medium text-slate-900">{hit.name}</span>
                      <span className="text-xs text-slate-600">Asset: {hit.assetTag}</span>
                      <span className="text-xs text-slate-600">
                        Serial: {hit.serialNumber || "Not recorded"}
                      </span>
                      {location ? (
                        <span className="text-xs text-slate-600">Location: {location}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {selectedAsset ? (
            <div className="space-y-2">
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                Selected: <strong>{selectedAsset.name}</strong>
                <span className="mt-1 block text-xs text-slate-600">
                  Asset: {selectedAsset.assetTag}
                  {selectedAsset.serialNumber ? ` · Serial: ${selectedAsset.serialNumber}` : ""}
                  {machineLocationLabel(selectedAsset) ? ` · Location: ${machineLocationLabel(selectedAsset)}` : ""}
                </span>
              </p>
              {openMatches.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <p>
                    {openMatches.length} open request{openMatches.length === 1 ? "" : "s"} already exist for this asset.
                  </p>
                  <ul className="mt-1 space-y-1">
                    {openMatches.map((item) => (
                      <li key={item.id}>
                        <Link href={`/requests/${item.id}` as Route} className="font-medium underline">
                          {item.requestNumber}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs">You can still report a new issue if this is a different problem.</p>
                </div>
              ) : null}
            </div>
          ) : null}
          {continueHint ? <p className="text-xs text-slate-500">{continueHint}</p> : null}
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
              onChange={(event) => {
                setVehicleQuery(event.target.value);
                setSelectedVehicle(null);
              }}
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
          <div aria-live="polite" className="min-h-5 text-sm text-slate-600">
            {searching ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={14} aria-hidden /> Searching vehicles...
              </span>
            ) : shouldSearchMachines(vehicleQuery) && vehicleHits.length === 0 ? (
              <p>No matching vehicles</p>
            ) : null}
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
          {continueHint ? <p className="text-xs text-slate-500">{continueHint}</p> : null}
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
          {sitesLoaded && sites.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              No sites or locations are set up yet.{" "}
              <button type="button" className="font-medium underline" onClick={() => chooseKind("NOT_SURE")}>
                Choose Not Sure and describe the place
              </button>{" "}
              — a reviewer will set the location.
            </p>
          ) : null}
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
          {siteId && locations.length === 0 ? (
            <p className="text-sm text-slate-600">
              This site has no locations yet.{" "}
              <button type="button" className="font-medium text-brand-700 underline" onClick={() => chooseKind("NOT_SURE")}>
                Use Not Sure
              </button>{" "}
              and describe the area instead.
            </p>
          ) : null}
          {continueHint ? <p className="text-xs text-slate-500">{continueHint}</p> : null}
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
            any job is created.
          </p>
          {sitesLoaded && sites.length === 0 ? null : (
            <select
              className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
              aria-label="Site"
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
          )}
          <textarea
            className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm"
            placeholder="Approximate area (building, room, yard, line…)"
            value={approximateLocation}
            onChange={(e) => setApproximateLocation(e.target.value)}
            maxLength={500}
          />
          {continueHint ? <p className="text-xs text-slate-500">{continueHint}</p> : null}
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
          {description.trim().length < 5 ? <p className="text-xs text-slate-500">Write at least 5 characters to continue.</p> : null}
          {photoLimit?.enabled ? (
            <PendingPhotoPicker files={photos} onChange={setPhotos} max={photoLimit.maxPhotos} disabled={submitting} />
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="button"
              disabled={description.trim().length < 5 || submitting}
              className="min-h-11 flex-1 rounded-lg border border-slate-300 text-sm disabled:opacity-40"
              onClick={() => setStep(4)}
            >
              More details
            </button>
            <button
              type="button"
              disabled={description.trim().length < 5 || submitting || !canContinueTarget}
              className="min-h-11 flex-[1.4] rounded-lg bg-brand-600 hover:bg-brand-700 text-sm font-medium text-white disabled:opacity-40"
              onClick={() => void submit()}
            >
              {submitting ? "Sending…" : "Send now"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Urgency is set to Normal. Choose More details to change urgency or safety impact.
          </p>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Urgency and impact</h2>
          <ChoiceGroup<ReportedUrgency>
            label="How urgent does this feel?"
            value={reportedUrgency}
            onChange={setReportedUrgency}
            options={[
              { value: "NORMAL", label: "Normal" },
              { value: "URGENT", label: "Urgent" },
              { value: "VERY_URGENT", label: "Very urgent" }
            ]}
          />
          <ChoiceGroup<SafetyImpact>
            label="Is anyone's safety at risk?"
            value={safetyImpact}
            onChange={setSafetyImpact}
            options={[
              { value: "NO", label: "No" },
              { value: "YES", label: "Yes" },
              { value: "NOT_SURE", label: "Not sure" }
            ]}
          />
          <ChoiceGroup<ProductionImpact>
            label="Is work or production affected?"
            value={productionImpact}
            onChange={setProductionImpact}
            options={[
              { value: "NONE", label: "None" },
              { value: "REDUCED", label: "Reduced" },
              { value: "STOPPED", label: "Stopped" },
              { value: "NOT_SURE", label: "Not sure" }
            ]}
          />
          <p className="text-xs text-slate-500">
            Maintenance staff set the official priority during review.
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
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Review & submit</h2>
          <p className="text-sm text-slate-600">Check your answers. Use Edit to change a step before you send it.</p>
          <div className="space-y-3">
            {reviewSections.map((section) => (
              <section key={section.step} aria-labelledby={`review-step-${section.step}`} className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <h3 id={`review-step-${section.step}`} className="text-sm font-semibold text-slate-800">
                    <span className="mr-1 text-slate-500">{section.step}.</span>
                    {section.title}
                  </h3>
                  <button
                    type="button"
                    className="min-h-11 shrink-0 px-2 text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
                    onClick={() => setStep(section.step as Step)}
                    aria-label={`Edit step ${section.step}: ${section.title}`}
                  >
                    Edit
                  </button>
                </div>
                <dl className="divide-y divide-slate-100">
                  {section.items.map((item) => (
                    <div key={item.question} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-3">
                      <dt className="text-slate-500">{item.question}</dt>
                      <dd className={`min-w-0 break-words font-medium text-slate-900 ${item.multiline ? "whitespace-pre-wrap" : ""}`}>
                        {item.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setStep(4)}>
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-sm font-medium text-white disabled:opacity-50"
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
