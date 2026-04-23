"use client";

import QRCode from "react-qr-code";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Plus, RefreshCw } from "lucide-react";

import { apiClient } from "@/lib/api-client";

type RoleName = "SUPER_ADMIN" | "ADMIN" | "SUPERVISOR" | "CLEANER" | "VIEWER" | string;

interface AuthUser {
  id: string;
  role?: {
    name?: RoleName;
  } | null;
}

interface CleanerOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: {
    name: string;
  };
}

interface LocationRow {
  id: string;
  name: string;
  area: string;
  building?: string | null;
  floor?: string | null;
  qrCode: string;
  scanUrl: string;
  shiftWindow?: string | null;
  shiftAssignment: "MORNING" | "EVENING" | "NIGHT" | "FLEXIBLE";
  cleaningFrequency: number;
  cleaningFrequencyUnit: "PER_DAY" | "PER_WEEK";
  assignedCleaner?: {
    firstName: string;
    lastName: string;
  } | null;
  isActive: boolean;
  todayVisitCount: number;
  expectedTodayVisits: number;
  pendingToday: number;
  openIssuesCount?: number;
}

interface CalendarEvent {
  date: string;
  locationId: string;
  locationName: string;
  expectedVisits: number;
  completedVisits: number;
  pendingVisits: number;
  status: "COMPLETED" | "PENDING" | "MISSED";
  shiftAssignment: "MORNING" | "EVENING" | "NIGHT" | "FLEXIBLE";
  shiftWindow: string | null;
  assignedCleaner: string | null;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nextDays(days: number) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  return {
    from: toIsoDate(now),
    to: toIsoDate(end)
  };
}

export default function CleaningLocationsPage() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [cleaners, setCleaners] = useState<CleanerOption[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [viewMode, setViewMode] = useState<"locations" | "calendar">("locations");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [regenerateId, setRegenerateId] = useState<string | null>(null);
  const [calendarRange, setCalendarRange] = useState(nextDays(13));

  const isAdmin = useMemo(() => {
    const role = user?.role?.name;
    return role === "ADMIN" || role === "SUPER_ADMIN";
  }, [user]);

  const groupedCalendar = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    calendarEvents.forEach((event) => {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    });

    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [calendarEvents]);

  const load = useCallback(() => {
    setLoading(true);

    Promise.all([
      apiClient.get("/cleaning/locations"),
      apiClient.get("/auth/me"),
      apiClient.get("/cleaning/users/cleaners"),
      apiClient.get("/cleaning/schedule/calendar", {
        params: {
          from: calendarRange.from,
          to: calendarRange.to
        }
      })
    ])
      .then(([locationsRes, meRes, cleanersRes, calendarRes]) => {
        setRows(locationsRes.data?.data ?? []);
        setUser(meRes.data?.data ?? null);
        setCleaners(cleanersRes.data?.data ?? []);
        setCalendarEvents(calendarRes.data?.data?.events ?? []);
        setError(null);
      })
      .catch((err: { response?: { data?: { message?: string } } }) => {
        setError(err?.response?.data?.message ?? "Failed to load cleaning location data");
      })
      .finally(() => setLoading(false));
  }, [calendarRange.from, calendarRange.to]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const checklistRaw = String(formData.get("checklist") ?? "").trim();
    const checklistItems = checklistRaw
      ? checklistRaw
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean)
          .map((label) => ({ label, required: false }))
      : undefined;

    const geoLatitudeValue = String(formData.get("geoLatitude") ?? "").trim();
    const geoLongitudeValue = String(formData.get("geoLongitude") ?? "").trim();

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post("/cleaning/locations", {
        name: String(formData.get("name") ?? ""),
        area: String(formData.get("area") ?? ""),
        building: String(formData.get("building") ?? "") || undefined,
        floor: String(formData.get("floor") ?? "") || undefined,
        description: String(formData.get("description") ?? "") || undefined,
        shiftWindow: String(formData.get("shiftWindow") ?? "") || undefined,
        cleaningFrequency: Number(formData.get("cleaningFrequency") ?? 1),
        cleaningFrequencyUnit: String(formData.get("cleaningFrequencyUnit") ?? "PER_DAY"),
        shiftAssignment: String(formData.get("shiftAssignment") ?? "MORNING"),
        assignedCleanerId: String(formData.get("assignedCleanerId") ?? "") || undefined,
        geoLatitude: geoLatitudeValue ? Number(geoLatitudeValue) : undefined,
        geoLongitude: geoLongitudeValue ? Number(geoLongitudeValue) : undefined,
        geoRadiusMeters: Number(formData.get("geoRadiusMeters") ?? 150),
        requireDeviceValidation: formData.get("requireDeviceValidation") === "on",
        requirePhotoEvidence: formData.get("requirePhotoEvidence") === "on",
        checklistItems
      });

      setShowForm(false);
      event.currentTarget.reset();
      load();
    } catch (err) {
      const typedError = err as { response?: { data?: { message?: string } } };
      setError(typedError?.response?.data?.message ?? "Failed to create location");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadQr = async (row: LocationRow) => {
    setDownloadId(row.id);
    setError(null);

    try {
      const response = await apiClient.get(`/cleaning/locations/${row.id}/qr`, {
        responseType: "blob"
      });

      const url = window.URL.createObjectURL(response.data as Blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const typedError = err as { response?: { data?: { message?: string } } };
      setError(typedError?.response?.data?.message ?? "Failed to download QR code");
    } finally {
      setDownloadId(null);
    }
  };

  const regenerateQr = async (row: LocationRow) => {
    setRegenerateId(row.id);
    setError(null);

    try {
      await apiClient.post(`/cleaning/locations/${row.id}/regenerate-qr`);
      await load();
    } catch (err) {
      const typedError = err as { response?: { data?: { message?: string } } };
      setError(typedError?.response?.data?.message ?? "Failed to regenerate QR code");
    } finally {
      setRegenerateId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Location Management</h1>
          <p className="text-sm text-slate-600">
            Assign cleaners, define shift/frequency rules, and monitor schedule execution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("locations")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              viewMode === "locations"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            Locations
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              viewMode === "calendar"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={14} /> Calendar View
            </span>
          </button>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowForm((current) => !current)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus size={16} />
              {showForm ? "Cancel" : "Add New Location"}
            </button>
          ) : null}
        </div>
      </div>

      {showForm ? (
        <form onSubmit={submit} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input
              required
              name="name"
              placeholder="Ground Floor - Male Toilet"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              name="area"
              placeholder="Area / Wing"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="building"
              placeholder="Building"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="floor"
              placeholder="Floor"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="shiftWindow"
              placeholder="Shift window (e.g. 06:00-14:00)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              name="shiftAssignment"
              defaultValue="MORNING"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="MORNING">Morning</option>
              <option value="EVENING">Evening</option>
              <option value="NIGHT">Night</option>
              <option value="FLEXIBLE">Flexible</option>
            </select>
            <input
              type="number"
              min={1}
              max={50}
              defaultValue={1}
              name="cleaningFrequency"
              placeholder="Frequency"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              name="cleaningFrequencyUnit"
              defaultValue="PER_DAY"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="PER_DAY">Per Day</option>
              <option value="PER_WEEK">Per Week</option>
            </select>
            <select
              name="assignedCleanerId"
              defaultValue=""
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {cleaners.map((cleaner) => (
                <option key={cleaner.id} value={cleaner.id}>
                  {cleaner.firstName} {cleaner.lastName} ({cleaner.role?.name ?? "CLEANER"})
                </option>
              ))}
            </select>
            <input
              name="geoLatitude"
              placeholder="Geo latitude (optional)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="geoLongitude"
              placeholder="Geo longitude (optional)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={25}
              max={5000}
              defaultValue={150}
              name="geoRadiusMeters"
              placeholder="Geo radius meters"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="requireDeviceValidation" />
              Require device validation
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="requirePhotoEvidence" />
              Require photo evidence
            </label>
            <textarea
              name="description"
              placeholder="Optional description"
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2 xl:col-span-3"
            />
            <textarea
              name="checklist"
              rows={4}
              placeholder={"Checklist items, one per line\nSanitize floor\nRestock tissue\nRefill soap"}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2 xl:col-span-3"
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create Location"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {viewMode === "locations" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Today</th>
                  <th className="px-4 py-3">QR</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Loading locations...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No cleaning locations found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{row.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {[row.area, row.building, row.floor].filter(Boolean).join(" · ")}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{row.qrCode}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <p className="font-medium">
                          {row.cleaningFrequency} {row.cleaningFrequencyUnit === "PER_DAY" ? "per day" : "per week"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.shiftAssignment} {row.shiftWindow ? `(${row.shiftWindow})` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {row.assignedCleaner
                          ? `${row.assignedCleaner.firstName} ${row.assignedCleaner.lastName}`
                          : "Unassigned"}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {row.todayVisitCount}/{row.expectedTodayVisits} complete
                        </span>
                        <p className="mt-1 text-xs text-amber-700">Pending: {row.pendingToday}</p>
                        <p className="text-xs text-red-700">Open issues: {row.openIssuesCount ?? 0}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-3">
                          <QRCode value={row.scanUrl} size={72} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <a
                            href={row.scanUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs font-medium text-sky-700 hover:text-sky-800"
                          >
                            Open scan URL
                          </a>
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => regenerateQr(row)}
                                disabled={regenerateId === row.id}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                <RefreshCw size={14} />
                                {regenerateId === row.id ? "Regenerating..." : "Regenerate QR"}
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadQr(row)}
                                disabled={downloadId === row.id}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                <Download size={14} />
                                {downloadId === row.id ? "Preparing..." : "Download QR"}
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">Admin actions only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm text-slate-600">
              <span className="mb-1 block">From</span>
              <input
                type="date"
                value={calendarRange.from}
                onChange={(event) => setCalendarRange((current) => ({ ...current, from: event.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-1 block">To</span>
              <input
                type="date"
                value={calendarRange.to}
                onChange={(event) => setCalendarRange((current) => ({ ...current, to: event.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={load}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Refresh Calendar
            </button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-slate-500">Loading calendar view...</p>
            ) : groupedCalendar.length === 0 ? (
              <p className="text-sm text-slate-500">No calendar schedule data available.</p>
            ) : (
              groupedCalendar.map(([date, events]) => (
                <div key={date} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-sm font-semibold text-slate-900">{new Date(date).toDateString()}</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {events.map((event) => (
                      <div
                        key={`${event.locationId}-${event.date}`}
                        className={`rounded-lg border p-3 text-sm ${
                          event.status === "COMPLETED"
                            ? "border-emerald-200 bg-emerald-50"
                            : event.status === "PENDING"
                              ? "border-amber-200 bg-amber-50"
                              : "border-red-200 bg-red-50"
                        }`}
                      >
                        <p className="font-semibold text-slate-900">{event.locationName}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {event.completedVisits}/{event.expectedVisits} completed
                        </p>
                        <p className="text-xs text-slate-600">Pending: {event.pendingVisits}</p>
                        <p className="text-xs text-slate-500">
                          {event.shiftAssignment} {event.shiftWindow ? `(${event.shiftWindow})` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          Cleaner: {event.assignedCleaner ?? "Unassigned"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
