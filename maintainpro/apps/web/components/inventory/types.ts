export type MovementType = "IN" | "OUT" | "ADJUSTMENT";

export type StockStatus = "IN_STOCK" | "LOW" | "CRITICAL" | "OUT_OF_STOCK";

export type PurchaseOrderStatus = "PENDING" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

export type InventorySortBy = "name" | "stock" | "unitCost" | "lastMovement" | "category";

export type SortDirection = "asc" | "desc";

export interface SupplierRecord {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockMovement {
  id: string;
  partId: string;
  type: MovementType;
  quantity: number;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface InventoryPart {
  id: string;
  partNumber: string;
  name: string;
  category: string;
  unitCost: number;
  unit?: string | null;
  minimumStock: number;
  reorderPoint: number;
  quantityInStock: number;
  location?: string | null;
  images: string[];
  isActive?: boolean;
  supplierId?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: SupplierRecord | null;
  stockMovements?: Array<Pick<StockMovement, "createdAt" | "type" | "quantity" | "reference" | "notes">>;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  orderDate: string;
  expectedDate?: string | null;
  receivedDate?: string | null;
  totalAmount: number;
  status: PurchaseOrderStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: SupplierRecord | null;
}

export interface LinkedWorkOrderPart {
  id: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  part?: {
    id: string;
    name: string;
    partNumber: string;
  };
}

export interface LinkedWorkOrder {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  dueDate?: string | null;
  createdAt: string;
  technician?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  asset?: {
    id: string;
    name?: string | null;
    assetTag?: string | null;
  } | null;
  vehicle?: {
    id: string;
    registrationNumber?: string | null;
  } | null;
  parts: LinkedWorkOrderPart[];
}

export interface UsageTrendPoint {
  date: string;
  quantity: number;
}

export interface TopUsedPartPoint {
  partId: string;
  partName: string;
  partNumber: string;
  quantity: number;
}

export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  criticalCount: number;
  outOfStockCount: number;
  pendingPurchaseOrders: number;
}

export interface InventoryFilters {
  search: string;
  stockStatus: "ALL" | StockStatus;
  category: string;
  supplierId: string;
  minStock: number | "";
  maxStock: number | "";
  sortBy: InventorySortBy;
  sortDirection: SortDirection;
  pendingPoOnly: boolean;
}

export interface InventoryInsights {
  mostUsedPart: TopUsedPartPoint | null;
  stalePartCount: number;
  avgDailyConsumption: number;
}

export interface StockAdjustmentPayload {
  id: string;
  quantity: number;
  notes?: string;
}

export interface UpdatePartPayload {
  id: string;
  data: Partial<Pick<InventoryPart, "name" | "category" | "unitCost" | "minimumStock" | "reorderPoint" | "location">>;
}
