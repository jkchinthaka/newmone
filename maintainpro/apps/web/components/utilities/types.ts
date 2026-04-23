export type UtilityType = "ELECTRICITY" | "WATER" | "GAS";

export type BillStatus = "UNPAID" | "PAID" | "OVERDUE" | "DISPUTED";

export type UtilityTab = "overview" | "meters" | "readings" | "bills" | "analytics";

export type UtilityRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "ASSET_MANAGER"
  | "SUPERVISOR"
  | "MECHANIC"
  | "DRIVER"
  | "VIEWER"
  | string;

export interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

export interface UtilityMeter {
  id: string;
  meterNumber: string;
  type: UtilityType;
  location: string;
  description?: string | null;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeterReading {
  id: string;
  meterId: string;
  readingDate: string;
  readingValue: number;
  consumption: number | null;
  images: string[];
  notes?: string | null;
  createdAt: string;
  meter?: UtilityMeter;
}

export interface UtilityBill {
  id: string;
  meterId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalConsumption: number;
  ratePerUnit: number;
  baseCharge: number | null;
  taxAmount: number | null;
  totalAmount: number;
  dueDate: string | null;
  paidDate: string | null;
  status: BillStatus;
  invoiceUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  meter?: UtilityMeter;
}

export interface UtilityAnalyticsSummary {
  type: UtilityType;
  totalConsumption: number;
  totalCost: number;
}

export interface UtilityAnalyticsMonthlyPoint {
  month: string;
  meterType: UtilityType;
  consumption: number;
  totalAmount: number;
  location: string;
}

export interface UtilityAnalytics {
  summaryByUtilityType: UtilityAnalyticsSummary[];
  monthly: UtilityAnalyticsMonthlyPoint[];
}

export interface MeterFormValues {
  meterNumber: string;
  type: UtilityType;
  location: string;
  description?: string;
  unit: string;
}

export interface ReadingFormValues {
  meterId: string;
  readingDate: string;
  readingValue: number;
  notes?: string;
  images?: string;
}

export interface BillFormValues {
  meterId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalConsumption: number;
  ratePerUnit: number;
  baseCharge?: number;
  taxAmount?: number;
  dueDate?: string;
  notes?: string;
}

export type UtilityTypeFilter = "ALL" | UtilityType;

export interface AnalyticsFilters {
  startDate: string;
  endDate: string;
  utilityType: UtilityTypeFilter;
}

export interface TrendInfo {
  value: number;
  previous: number;
  direction: "up" | "down" | "flat";
  deltaPercent: number;
}
