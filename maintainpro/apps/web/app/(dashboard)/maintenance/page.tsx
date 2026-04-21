const upcoming = [
  { task: "Truck A Brake Service", due: "2026-04-24", frequency: "Mileage Based" },
  { task: "Boiler Inspection", due: "2026-04-25", frequency: "Monthly" },
  { task: "Cooling Unit Calibration", due: "2026-04-27", frequency: "Quarterly" }
];

export default function MaintenancePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Maintenance Calendar</h2>
      <div className="card">
        <p className="text-sm text-slate-600">Calendar view placeholder: integrate full calendar component for weekly/monthly scheduling.</p>
      </div>
      <div className="card">
        <h3 className="text-sm font-medium text-slate-700">Upcoming Maintenance</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {upcoming.map((item) => (
            <li key={item.task} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span>{item.task}</span>
              <span className="text-slate-500">{item.due} • {item.frequency}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
