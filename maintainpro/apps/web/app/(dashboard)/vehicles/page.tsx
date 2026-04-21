const vehicles = [
  { reg: "MH-01-AB-101", model: "Toyota Hilux", status: "Available", mileage: 28410 },
  { reg: "MH-01-AB-102", model: "Tata 407", status: "In Use", mileage: 54120 },
  { reg: "MH-01-AB-103", model: "Eicher Pro", status: "Maintenance", mileage: 78840 }
];

export default function VehiclesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Vehicles</h2>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">Register Vehicle</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((vehicle) => (
          <article key={vehicle.reg} className="card">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{vehicle.reg}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{vehicle.model}</h3>
            <p className="mt-1 text-sm text-slate-600">Status: {vehicle.status}</p>
            <p className="mt-1 text-sm text-slate-600">Mileage: {vehicle.mileage.toLocaleString()} km</p>
          </article>
        ))}
      </div>
    </div>
  );
}
