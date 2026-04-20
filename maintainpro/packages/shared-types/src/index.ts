export type UserRole = "admin" | "manager" | "technician";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  location: string;
  status: "active" | "inactive" | "maintenance";
  imageUrl?: string;
}

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "completed" | "cancelled";
  dueDate: string;
  assetCode: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  reorderLevel: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DashboardKpis {
  openWorkOrders: number;
  mttrHours: number;
  onTimePmRate: number;
  lowStockItems: number;
}
