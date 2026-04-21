const parts = [
  { sku: "SP-2001", name: "Hydraulic Valve", stock: 2, reorder: 3 },
  { sku: "SP-2002", name: "Bearing Kit", stock: 12, reorder: 4 },
  { sku: "SP-2003", name: "Pressure Sensor", stock: 1, reorder: 5 }
];

export default function InventoryPage() {
  const lowStock = parts.filter((part) => part.stock <= part.reorder);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Inventory</h2>
      {lowStock.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Low stock alert: {lowStock.length} parts need replenishment.
        </div>
      ) : null}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">Part Number</th>
              <th className="py-2">Name</th>
              <th className="py-2">Stock</th>
              <th className="py-2">Reorder Point</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr key={part.sku} className="border-b border-slate-100">
                <td className="py-3 font-medium text-slate-800">{part.sku}</td>
                <td className="py-3">{part.name}</td>
                <td className="py-3">{part.stock}</td>
                <td className="py-3">{part.reorder}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
