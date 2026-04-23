import * as XLSX from "xlsx";

import { InventoryFilters, InventoryInsights, InventoryPart, InventorySummary, PurchaseOrder, StockMovement, StockStatus, TopUsedPartPoint, UsageTrendPoint } from "./types";

export const INVENTORY_FILTERS_STORAGE_KEY = "inventory-filters-v1";

const PENDING_PO_STATUSES = new Set(["PENDING", "ORDERED", "PARTIALLY_RECEIVED"]);

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date);
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function getLastMovementDate(part: InventoryPart): string | null {
  return part.stockMovements?.[0]?.createdAt ?? null;
}

export function getStockStatus(part: InventoryPart): StockStatus {
  if (part.quantityInStock <= 0) {
    return "OUT_OF_STOCK";
  }

  if (part.quantityInStock <= part.reorderPoint) {
    return "CRITICAL";
  }

  if (part.quantityInStock <= part.minimumStock) {
    return "LOW";
  }

  return "IN_STOCK";
}

export function getStockStatusMeta(status: StockStatus): { label: string; tone: string; meterTone: string } {
  switch (status) {
    case "OUT_OF_STOCK":
      return {
        label: "Out of Stock",
        tone: "bg-rose-100 text-rose-700 border-rose-200",
        meterTone: "bg-rose-500"
      };
    case "CRITICAL":
      return {
        label: "Critical",
        tone: "bg-rose-50 text-rose-700 border-rose-200",
        meterTone: "bg-rose-500"
      };
    case "LOW":
      return {
        label: "Low",
        tone: "bg-amber-50 text-amber-800 border-amber-200",
        meterTone: "bg-amber-500"
      };
    case "IN_STOCK":
    default:
      return {
        label: "In Stock",
        tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
        meterTone: "bg-emerald-500"
      };
  }
}

export function stockProgress(part: InventoryPart): number {
  const threshold = Math.max(1, part.minimumStock, part.reorderPoint);
  return Math.max(0, Math.min(100, (part.quantityInStock / threshold) * 100));
}

export function calculateSummary(parts: InventoryPart[], purchaseOrders: PurchaseOrder[]): InventorySummary {
  const totalItems = parts.length;
  const totalValue = parts.reduce((sum, part) => sum + part.quantityInStock * part.unitCost, 0);

  let lowStockCount = 0;
  let criticalCount = 0;
  let outOfStockCount = 0;

  for (const part of parts) {
    const status = getStockStatus(part);

    if (status === "LOW") {
      lowStockCount += 1;
    }

    if (status === "CRITICAL") {
      criticalCount += 1;
    }

    if (status === "OUT_OF_STOCK") {
      outOfStockCount += 1;
    }
  }

  const pendingPurchaseOrders = purchaseOrders.filter((order) => PENDING_PO_STATUSES.has(order.status)).length;

  return {
    totalItems,
    totalValue,
    lowStockCount,
    criticalCount,
    outOfStockCount,
    pendingPurchaseOrders
  };
}

export function calculateInsights(parts: InventoryPart[], usageTrend: UsageTrendPoint[], topUsed: TopUsedPartPoint[]): InventoryInsights {
  const mostUsedPart = topUsed[0] ?? null;

  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const stalePartCount = parts.filter((part) => {
    const movementDate = getLastMovementDate(part);

    if (!movementDate) {
      return true;
    }

    return new Date(movementDate).getTime() < sixtyDaysAgo;
  }).length;

  const totalConsumption = usageTrend.reduce((sum, point) => sum + point.quantity, 0);
  const avgDailyConsumption = usageTrend.length > 0 ? totalConsumption / usageTrend.length : 0;

  return {
    mostUsedPart,
    stalePartCount,
    avgDailyConsumption
  };
}

export function derivePendingSupplierIds(orders: PurchaseOrder[]): Set<string> {
  return new Set(orders.filter((order) => PENDING_PO_STATUSES.has(order.status)).map((order) => order.supplierId));
}

export function applyInventoryFilters(parts: InventoryPart[], filters: InventoryFilters, pendingSupplierIds: Set<string>): InventoryPart[] {
  const searchValue = filters.search.trim().toLowerCase();

  const filtered = parts.filter((part) => {
    if (searchValue) {
      const text = `${part.name} ${part.partNumber}`.toLowerCase();
      if (!text.includes(searchValue)) {
        return false;
      }
    }

    if (filters.stockStatus !== "ALL" && getStockStatus(part) !== filters.stockStatus) {
      return false;
    }

    if (filters.category && part.category !== filters.category) {
      return false;
    }

    if (filters.supplierId && part.supplierId !== filters.supplierId) {
      return false;
    }

    if (filters.pendingPoOnly && (!part.supplierId || !pendingSupplierIds.has(part.supplierId))) {
      return false;
    }

    if (filters.minStock !== "" && part.quantityInStock < filters.minStock) {
      return false;
    }

    if (filters.maxStock !== "" && part.quantityInStock > filters.maxStock) {
      return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    const direction = filters.sortDirection === "asc" ? 1 : -1;

    switch (filters.sortBy) {
      case "stock":
        return (a.quantityInStock - b.quantityInStock) * direction;
      case "unitCost":
        return (a.unitCost - b.unitCost) * direction;
      case "lastMovement": {
        const aTime = getLastMovementDate(a) ? new Date(getLastMovementDate(a) as string).getTime() : 0;
        const bTime = getLastMovementDate(b) ? new Date(getLastMovementDate(b) as string).getTime() : 0;
        return (aTime - bTime) * direction;
      }
      case "category":
        return a.category.localeCompare(b.category) * direction;
      case "name":
      default:
        return a.name.localeCompare(b.name) * direction;
    }
  });

  return filtered;
}

export function estimateRunoutDays(part: InventoryPart, movements: StockMovement[], windowDays = 30): number | null {
  if (part.quantityInStock <= 0) {
    return 0;
  }

  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const outQuantity = movements
    .filter((movement) => movement.type === "OUT" && new Date(movement.createdAt).getTime() >= since)
    .reduce((sum, movement) => sum + movement.quantity, 0);

  const avgDaily = outQuantity / windowDays;

  if (avgDaily <= 0) {
    return null;
  }

  return part.quantityInStock / avgDaily;
}

export function toExportRows(parts: InventoryPart[]) {
  return parts.map((part) => {
    const status = getStockStatusMeta(getStockStatus(part)).label;

    return {
      "Part Number": part.partNumber,
      Name: part.name,
      Category: part.category,
      Supplier: part.supplier?.name ?? "-",
      "Current Stock": part.quantityInStock,
      "Minimum Stock": part.minimumStock,
      "Reorder Point": part.reorderPoint,
      Status: status,
      "Unit Cost": part.unitCost,
      "Stock Value": Number((part.quantityInStock * part.unitCost).toFixed(2)),
      "Last Movement": formatDate(getLastMovementDate(part))
    };
  });
}

export function downloadCsv(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) {
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(",")];

  for (const row of rows) {
    const values = headers.map((key) => {
      const raw = String(row[key] ?? "");
      const escaped = raw.replaceAll('"', '""');
      return `"${escaped}"`;
    });

    csvLines.push(values.join(","));
  }

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadXlsx(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) {
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
  XLSX.writeFile(workbook, filename);
}

export function printInventoryReport(parts: InventoryPart[], title: string) {
  const reportWindow = window.open("", "_blank", "width=1024,height=768");

  if (!reportWindow) {
    return;
  }

  const rows = toExportRows(parts)
    .map((row) => {
      const cells = Object.values(row)
        .map((value) => `<td style=\"padding:8px;border:1px solid #d1d5db;font-size:12px;\">${String(value)}</td>`)
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  reportWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
      </head>
      <body style="font-family:Segoe UI, Arial, sans-serif;padding:24px;">
        <h1 style="margin-bottom:4px;">${title}</h1>
        <p style="margin-top:0;margin-bottom:16px;color:#475569;">Generated on ${new Date().toLocaleString()}</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              ${Object.keys(toExportRows(parts)[0] ?? {})
                .map((header) => `<th style=\"padding:8px;border:1px solid #d1d5db;background:#f8fafc;font-size:12px;text-align:left;\">${header}</th>`)
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `);

  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const anyError = error as { response?: { data?: { message?: string | string[] } }; message?: string };
    const responseMessage = anyError.response?.data?.message;

    if (Array.isArray(responseMessage)) {
      return responseMessage.join(", ");
    }

    if (responseMessage) {
      return responseMessage;
    }

    if (anyError.message) {
      return anyError.message;
    }
  }

  return "Something went wrong. Please try again.";
}

export function saveFilters(filters: InventoryFilters) {
  localStorage.setItem(INVENTORY_FILTERS_STORAGE_KEY, JSON.stringify(filters));
}

export function loadSavedFilters(fallback: InventoryFilters): InventoryFilters {
  try {
    const raw = localStorage.getItem(INVENTORY_FILTERS_STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<InventoryFilters>;

    return {
      ...fallback,
      ...parsed
    };
  } catch {
    return fallback;
  }
}

export const DEFAULT_FILTERS: InventoryFilters = {
  search: "",
  stockStatus: "ALL",
  category: "",
  supplierId: "",
  minStock: "",
  maxStock: "",
  sortBy: "name",
  sortDirection: "asc",
  pendingPoOnly: false
};
