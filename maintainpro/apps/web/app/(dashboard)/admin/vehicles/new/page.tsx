"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";

export default function RegisterVehiclePage() {
  const user = useCurrentUser();
  const [registrationNo, setRegistrationNo] = useState("");
  const [make, setMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [createdId, setCreatedId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") return <p className="p-4">Access required</p>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await apiClient.post("/vehicles", {
        registrationNo,
        make,
        vehicleModel,
        year: Number(year),
        type: "CAR"
      });
      setCreatedId(response.data?.data?.id ?? "");
      setRegistrationNo("");
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The vehicle could not be registered."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Register vehicle</h1>
      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm" htmlFor="registration">Registration number</label>
        <input id="registration" className="h-11 w-full rounded-md border px-3" required value={registrationNo} onChange={(event) => setRegistrationNo(event.target.value)} />
        <label className="block text-sm" htmlFor="make">Make</label>
        <input id="make" className="h-11 w-full rounded-md border px-3" required value={make} onChange={(event) => setMake(event.target.value)} />
        <label className="block text-sm" htmlFor="model">Model</label>
        <input id="model" className="h-11 w-full rounded-md border px-3" required value={vehicleModel} onChange={(event) => setVehicleModel(event.target.value)} />
        <label className="block text-sm" htmlFor="year">Year</label>
        <input id="year" className="h-11 w-full rounded-md border px-3" required value={year} onChange={(event) => setYear(event.target.value)} />
        {error ? <p role="alert">{error}</p> : null}
        <button className="h-11 rounded-md bg-slate-900 px-4 text-white disabled:opacity-60" disabled={saving} type="submit">Register vehicle</button>
      </form>
      {createdId ? (
        <div className="space-y-2">
          <p role="status">Vehicle registered.</p>
          <Link href={`/vehicles/${createdId}` as never}>Open vehicle</Link>
          <button type="button" onClick={() => setCreatedId("")}>Register another</button>
        </div>
      ) : null}
    </main>
  );
}
