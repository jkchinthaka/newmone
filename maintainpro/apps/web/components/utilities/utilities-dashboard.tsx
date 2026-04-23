"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Droplets,
  FileText,
  Gauge,
  Layers,
  TrendingUp,
  Zap
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getStoredRole } from "@/lib/user-role";

import { AnalyticsCharts } from "./analytics-charts";
import { BillsTable } from "./bills-table";
import {
  billStatusTone,
  buildConsumptionTrendSeries,
  buildCostByTypeSeries,
  buildCurrentMonthConsumption,
  buildPreviousMonthConsumption,
  buildTopMeterSeries,
  detectConsumptionSpikes,
  formatCompact,
  formatCurrency,
  formatDate,
  formatMonth,
  formatQuantity,
  getComputedBillStatus,
  getErrorMessage,
  getTrend,
  toNumber,
  utilityTypeLabel
} from "./helpers";
import {
  useCreateUtilityBillMutation,
  useCreateUtilityMeterMutation,
  useCreateUtilityReadingMutation,
  useMarkBillPaidMutation,
  useUpdateUtilityMeterMutation,
  useUtilityAnalyticsQuery,
  useUtilityBillsQuery,
  useUtilityMetersQuery,
  useUtilityReadingsQuery
} from "./hooks";
import { MeterTable } from "./meter-table";
import { ReadingTable } from "./reading-table";
import { EmptyState, LoadingPanel, ModalShell, StatCard, StatusBadge } from "./shared-ui";
import type {
  AnalyticsFilters,
  BillFormValues,
  MeterFormValues,
  ReadingFormValues,
  UtilityBill,
  UtilityMeter,
  UtilityRole,
  UtilityTab,
  UtilityType,
  UtilityTypeFilter
} from "./types";

const meterFormSchema = z.object({
  meterNumber: z.string().trim().min(2, "Meter number is required"),
  type: z.enum(["ELECTRICITY", "WATER", "GAS"]),
  location: z.string().trim().min(2, "Location is required"),
  unit: z.string().trim().min(1, "Unit is required"),
  description: z.string().trim().optional()
});

const readingFormSchema = z.object({
  meterId: z.string().min(1, "Meter is required"),
  readingDate: z.string().min(1, "Reading date is required"),
  readingValue: z.coerce.number().min(0, "Reading value must be non-negative"),
  notes: z.string().trim().optional(),
  images: z.string().trim().optional()
});

const billFormSchema = z
  .object({
    meterId: z.string().min(1, "Meter is required"),
    billingPeriodStart: z.string().min(1, "Billing start date is required"),
    billingPeriodEnd: z.string().min(1, "Billing end date is required"),
    totalConsumption: z.coerce.number().positive("Consumption must be greater than 0"),
    ratePerUnit: z.coerce.number().positive("Rate must be greater than 0"),
    baseCharge: z.coerce.number().min(0).optional(),
    taxAmount: z.coerce.number().min(0).optional(),
    dueDate: z.string().optional(),
    notes: z.string().trim().optional()
  })
  .refine((values) => values.billingPeriodEnd >= values.billingPeriodStart, {
    path: ["billingPeriodEnd"],
    message: "Billing period end date must be on or after start date"
  });

const TABS: Array<{ key: UtilityTab; label: string; icon: typeof Layers }> = [
  { key: "overview", label: "Overview", icon: Layers },
  { key: "meters", label: "Meters", icon: Gauge },
  { key: "readings", label: "Readings", icon: Activity },
  { key: "bills", label: "Bills", icon: FileText },
  { key: "analytics", label: "Analytics", icon: BarChart3 }
];

const PIE_COLORS = ["#1476d6", "#0e9aa7", "#8b5cf6", "#f59e0b"];

const UTILITY_WRITE_ROLES = new Set<UtilityRole>(["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"]);

function defaultAnalyticsFilters(): AnalyticsFilters {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
    utilityType: "ALL"
  };
}

function utilityFilterMatch(type: UtilityType, filter: UtilityTypeFilter): boolean {
  if (filter === "ALL") {
    return true;
  }

  return type === filter;
}

function overviewCostTrendByMonth(
  monthlyRows: Array<{ month: string; meterType: UtilityType; totalAmount: number }>
): Array<{ month: string; label: string; totalCost: number }> {
  const grouped = new Map<string, { month: string; totalCost: number }>();

  monthlyRows.forEach((row) => {
    const current = grouped.get(row.month) ?? { month: row.month, totalCost: 0 };
    current.totalCost += toNumber(row.totalAmount);
    grouped.set(row.month, current);
  });

  return [...grouped.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      ...item,
      label: formatMonth(item.month)
    }));
}

export default function UtilitiesDashboard() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<UtilityTab>("overview");
  const [role, setRole] = useState<UtilityRole>("VIEWER");

  const [meterSearch, setMeterSearch] = useState("");
  const [meterTypeFilter, setMeterTypeFilter] = useState<UtilityTypeFilter>("ALL");
  const [selectedMeterId, setSelectedMeterId] = useState("");
  const [analyticsFilters, setAnalyticsFilters] = useState<AnalyticsFilters>(defaultAnalyticsFilters);

  const [meterModalState, setMeterModalState] = useState<{ open: boolean; mode: "create" | "edit"; meter: UtilityMeter | null }>({
    open: false,
    mode: "create",
    meter: null
  });
  const [readingModalOpen, setReadingModalOpen] = useState(false);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billDetailsTarget, setBillDetailsTarget] = useState<UtilityBill | null>(null);
  const [payConfirmTarget, setPayConfirmTarget] = useState<UtilityBill | null>(null);

  const metersQuery = useUtilityMetersQuery();
  const readingsQuery = useUtilityReadingsQuery();
  const billsQuery = useUtilityBillsQuery();
  const analyticsQuery = useUtilityAnalyticsQuery();

  const createMeterMutation = useCreateUtilityMeterMutation();
  const updateMeterMutation = useUpdateUtilityMeterMutation();
  const createReadingMutation = useCreateUtilityReadingMutation();
  const createBillMutation = useCreateUtilityBillMutation();
  const markBillPaidMutation = useMarkBillPaidMutation();

  const meterForm = useForm<MeterFormValues>({
    resolver: zodResolver(meterFormSchema),
    defaultValues: {
      meterNumber: "",
      type: "ELECTRICITY",
      location: "",
      unit: "kWh",
      description: ""
    }
  });

  const readingForm = useForm<ReadingFormValues>({
    resolver: zodResolver(readingFormSchema),
    defaultValues: {
      meterId: "",
      readingDate: new Date().toISOString().slice(0, 10),
      readingValue: 0,
      notes: "",
      images: ""
    }
  });

  const billForm = useForm<BillFormValues>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      meterId: "",
      billingPeriodStart: new Date().toISOString().slice(0, 10),
      billingPeriodEnd: new Date().toISOString().slice(0, 10),
      totalConsumption: 0,
      ratePerUnit: 0,
      baseCharge: 0,
      taxAmount: 0,
      dueDate: "",
      notes: ""
    }
  });

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (!requestedTab) {
      return;
    }

    if (requestedTab === "overview" || requestedTab === "meters" || requestedTab === "readings" || requestedTab === "bills" || requestedTab === "analytics") {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  const meters = metersQuery.data ?? [];
  const readings = readingsQuery.data ?? [];
  const bills = billsQuery.data ?? [];
  const analytics = analyticsQuery.data ?? { summaryByUtilityType: [], monthly: [] };

  useEffect(() => {
    if (!selectedMeterId && meters.length > 0) {
      setSelectedMeterId(meters[0].id);
      readingForm.setValue("meterId", meters[0].id);
      billForm.setValue("meterId", meters[0].id);
    }
  }, [meters, selectedMeterId, billForm, readingForm]);

  const canManage = UTILITY_WRITE_ROLES.has(role);

  const meterById = useMemo(() => new Map(meters.map((meter) => [meter.id, meter])), [meters]);

  const hydratedReadings = useMemo(
    () =>
      readings.map((reading) => ({
        ...reading,
        meter: reading.meter ?? meterById.get(reading.meterId)
      })),
    [readings, meterById]
  );

  const hydratedBills = useMemo(
    () =>
      bills.map((bill) => ({
        ...bill,
        meter: bill.meter ?? meterById.get(bill.meterId)
      })),
    [bills, meterById]
  );

  const filteredMeters = useMemo(() => {
    const query = meterSearch.trim().toLowerCase();

    return meters.filter((meter) => {
      const textMatch =
        query.length === 0 ||
        meter.meterNumber.toLowerCase().includes(query) ||
        meter.location.toLowerCase().includes(query);

      const typeMatch = meterTypeFilter === "ALL" || meter.type === meterTypeFilter;
      return textMatch && typeMatch;
    });
  }, [meters, meterSearch, meterTypeFilter]);

  const selectedMeter = selectedMeterId ? meterById.get(selectedMeterId) ?? null : null;

  const selectedMeterReadings = useMemo(
    () =>
      hydratedReadings
        .filter((reading) => (selectedMeterId ? reading.meterId === selectedMeterId : true))
        .sort((a, b) => a.readingDate.localeCompare(b.readingDate)),
    [hydratedReadings, selectedMeterId]
  );

  const selectedMeterReadingChart = selectedMeterReadings.map((reading) => ({
    label: formatDate(reading.readingDate),
    consumption: toNumber(reading.consumption),
    readingValue: toNumber(reading.readingValue)
  }));

  const activeMetersCount = meters.filter((meter) => meter.isActive).length;
  const currentMonthConsumption = buildCurrentMonthConsumption(hydratedBills);
  const previousMonthConsumption = buildPreviousMonthConsumption(hydratedBills);
  const consumptionTrend = getTrend(currentMonthConsumption, previousMonthConsumption);

  const paidBills = hydratedBills.filter((bill) => getComputedBillStatus(bill) === "PAID");
  const unpaidBills = hydratedBills.filter((bill) => getComputedBillStatus(bill) !== "PAID");
  const overdueBills = hydratedBills.filter((bill) => getComputedBillStatus(bill) === "OVERDUE");

  const overdueAmount = overdueBills.reduce((sum, bill) => sum + toNumber(bill.totalAmount), 0);

  const overviewConsumptionSeries = buildConsumptionTrendSeries(analytics);
  const overviewCostByType = buildCostByTypeSeries(analytics);
  const overviewCostTrend = overviewCostTrendByMonth(analytics.monthly);

  const activityFeed = useMemo(() => {
    const readingEvents = hydratedReadings.slice(0, 6).map((reading) => ({
      id: `reading-${reading.id}`,
      kind: "Reading",
      title: `${reading.meter?.meterNumber ?? "Unknown meter"} reading recorded`,
      detail: `${formatQuantity(reading.readingValue)} ${reading.meter?.unit ?? ""}`.trim(),
      timestamp: reading.readingDate
    }));

    const billEvents = hydratedBills.slice(0, 6).map((bill) => ({
      id: `bill-${bill.id}`,
      kind: "Bill",
      title: `${bill.meter?.meterNumber ?? "Unknown meter"} bill generated`,
      detail: formatCurrency(toNumber(bill.totalAmount)),
      timestamp: bill.billingPeriodEnd
    }));

    const paymentEvents = hydratedBills
      .filter((bill) => bill.paidDate)
      .slice(0, 6)
      .map((bill) => ({
        id: `paid-${bill.id}`,
        kind: "Payment",
        title: `${bill.meter?.meterNumber ?? "Unknown meter"} payment confirmed`,
        detail: formatCurrency(toNumber(bill.totalAmount)),
        timestamp: bill.paidDate as string
      }));

    return [...readingEvents, ...billEvents, ...paymentEvents]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8);
  }, [hydratedBills, hydratedReadings]);

  const spikes = detectConsumptionSpikes(hydratedReadings, meters);

  const topMeterSeries = buildTopMeterSeries(hydratedBills, meters, analyticsFilters);
  const highestConsumingMeter = topMeterSeries[0];

  const costByMonth = overviewCostTrend;
  const costSpikeAlert = useMemo(() => {
    if (costByMonth.length < 2) {
      return null;
    }

    const current = costByMonth[costByMonth.length - 1]?.totalCost ?? 0;
    const previous = costByMonth[costByMonth.length - 2]?.totalCost ?? 0;

    if (previous <= 0) {
      return null;
    }

    if (current >= previous * 1.5) {
      return {
        current,
        previous
      };
    }

    return null;
  }, [costByMonth]);

  const avgConsumptionPerMeter = activeMetersCount > 0 ? currentMonthConsumption / activeMetersCount : 0;

  const hasQueryError = Boolean(metersQuery.error || readingsQuery.error || billsQuery.error || analyticsQuery.error);
  const isInitialLoading = metersQuery.isLoading || readingsQuery.isLoading || billsQuery.isLoading || analyticsQuery.isLoading;

  const refetchAll = () => {
    metersQuery.refetch();
    readingsQuery.refetch();
    billsQuery.refetch();
    analyticsQuery.refetch();
  };

  const openCreateMeterModal = () => {
    meterForm.reset({
      meterNumber: "",
      type: "ELECTRICITY",
      location: "",
      unit: "kWh",
      description: ""
    });
    setMeterModalState({ open: true, mode: "create", meter: null });
  };

  const openEditMeterModal = (meter: UtilityMeter) => {
    meterForm.reset({
      meterNumber: meter.meterNumber,
      type: meter.type,
      location: meter.location,
      unit: meter.unit,
      description: meter.description ?? ""
    });
    setMeterModalState({ open: true, mode: "edit", meter });
  };

  const handleSaveMeter = meterForm.handleSubmit(async (values) => {
    try {
      if (meterModalState.mode === "create") {
        await createMeterMutation.mutateAsync(values);
        toast.success("Utility meter created");
      } else if (meterModalState.meter) {
        await updateMeterMutation.mutateAsync({
          id: meterModalState.meter.id,
          payload: {
            location: values.location,
            description: values.description,
            unit: values.unit
          }
        });
        toast.success("Utility meter updated");
      }

      setMeterModalState({ open: false, mode: "create", meter: null });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const handleToggleMeterStatus = async (meter: UtilityMeter) => {
    try {
      await updateMeterMutation.mutateAsync({
        id: meter.id,
        payload: {
          isActive: !meter.isActive
        }
      });
      toast.success(`Meter ${meter.isActive ? "deactivated" : "activated"}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openReadingModal = () => {
    const defaultMeter = selectedMeterId || meters[0]?.id || "";

    readingForm.reset({
      meterId: defaultMeter,
      readingDate: new Date().toISOString().slice(0, 10),
      readingValue: 0,
      notes: "",
      images: ""
    });

    setReadingModalOpen(true);
  };

  const handleAddReading = readingForm.handleSubmit(async (values) => {
    const previous = hydratedReadings
      .filter((reading) => reading.meterId === values.meterId)
      .sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0];

    if (previous && values.readingValue < toNumber(previous.readingValue)) {
      readingForm.setError("readingValue", {
        message: `Reading must be at least ${formatQuantity(toNumber(previous.readingValue))}`
      });
      toast.error("Reading value cannot decrease compared to the latest reading.");
      return;
    }

    try {
      await createReadingMutation.mutateAsync(values);
      toast.success("Meter reading added");
      setReadingModalOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const openBillModal = () => {
    const defaultMeter = meters[0]?.id ?? "";

    billForm.reset({
      meterId: defaultMeter,
      billingPeriodStart: new Date().toISOString().slice(0, 10),
      billingPeriodEnd: new Date().toISOString().slice(0, 10),
      totalConsumption: 0,
      ratePerUnit: 0,
      baseCharge: 0,
      taxAmount: 0,
      dueDate: "",
      notes: ""
    });

    setBillModalOpen(true);
  };

  const handleCreateBill = billForm.handleSubmit(async (values) => {
    try {
      await createBillMutation.mutateAsync(values);
      toast.success("Utility bill created");
      setBillModalOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const confirmPayBill = async () => {
    if (!payConfirmTarget) {
      return;
    }

    try {
      await markBillPaidMutation.mutateAsync(payConfirmTarget.id);
      toast.success("Bill marked as paid");
      setPayConfirmTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (isInitialLoading) {
    return (
      <div className="space-y-4">
        <LoadingPanel className="h-32" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LoadingPanel className="h-32" />
          <LoadingPanel className="h-32" />
          <LoadingPanel className="h-32" />
          <LoadingPanel className="h-32" />
        </div>
        <LoadingPanel className="h-[420px]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Utilities</h2>
          <p className="mt-1 text-sm text-slate-500">
            Live utility intelligence across meter operations, consumption tracking, and billing workflows.
          </p>
        </div>
        <button
          type="button"
          onClick={refetchAll}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Refresh data
        </button>
      </header>

      {hasQueryError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Some utility data failed to load. Please retry. {(metersQuery.error || readingsQuery.error || billsQuery.error || analyticsQuery.error) ? (
            <span className="ml-1 text-rose-800">
              {getErrorMessage(metersQuery.error || readingsQuery.error || billsQuery.error || analyticsQuery.error)}
            </span>
          ) : null}
        </div>
      ) : null}

      {overdueBills.length > 0 || spikes.length > 0 || costSpikeAlert ? (
        <section className="space-y-3">
          {overdueBills.length > 0 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5" size={16} />
              <div>
                <p className="font-semibold">Overdue bills detected</p>
                <p className="mt-1">
                  {overdueBills.length} bill(s) are overdue totaling {formatCurrency(overdueAmount)}.
                </p>
              </div>
            </div>
          ) : null}

          {spikes.length > 0 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              <TrendingUp className="mt-0.5" size={16} />
              <div>
                <p className="font-semibold">Abnormal consumption spike detected</p>
                <p className="mt-1">
                  Latest spike on {spikes[0]?.meterNumber} at {formatDate(spikes[0]?.date)} with
                  consumption {formatQuantity(spikes[0]?.consumption ?? 0)}.
                </p>
              </div>
            </div>
          ) : null}

          {costSpikeAlert ? (
            <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-700">
              <BarChart3 className="mt-0.5" size={16} />
              <div>
                <p className="font-semibold">Cost spike alert</p>
                <p className="mt-1">
                  Monthly utility costs increased from {formatCurrency(costSpikeAlert.previous)} to {formatCurrency(costSpikeAlert.current)}.
                </p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Active Meters"
          value={String(activeMetersCount)}
          supportingText={`${meters.length} total meters`}
          icon={<Gauge size={18} />}
        />
        <StatCard
          label="Current Month Consumption"
          value={formatCompact(currentMonthConsumption)}
          supportingText="Across billed meters"
          icon={<Zap size={18} />}
          trend={{
            direction: consumptionTrend.direction,
            value: `${consumptionTrend.deltaPercent.toFixed(1)}% vs previous month`
          }}
        />
        <StatCard
          label="Total Bills"
          value={`${paidBills.length} / ${unpaidBills.length}`}
          supportingText="Paid vs unpaid"
          icon={<FileText size={18} />}
        />
        <StatCard
          label="Overdue Bills"
          value={String(overdueBills.length)}
          supportingText={formatCurrency(overdueAmount)}
          icon={<AlertTriangle size={18} />}
          trend={{
            direction: overdueBills.length > 0 ? "up" : "flat",
            value: overdueBills.length > 0 ? "Needs action" : "On track"
          }}
        />
      </section>

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isActive ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "overview" ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">Monthly consumption trend by utility type</h3>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overviewConsumptionSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => formatCompact(Number(value))} />
                  <Tooltip formatter={(value: number) => formatCompact(value)} />
                  <Legend />
                  <Line dataKey="ELECTRICITY" name="Electricity" stroke="#1476d6" strokeWidth={2.5} dot={false} />
                  <Line dataKey="WATER" name="Water" stroke="#0e9aa7" strokeWidth={2.5} dot={false} />
                  <Line dataKey="GAS" name="Gas" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Utility distribution (cost)</h3>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overviewCostByType} dataKey="totalCost" nameKey="label" innerRadius={64} outerRadius={104} paddingAngle={4}>
                    {overviewCostByType.map((entry, index) => (
                      <Cell key={entry.type} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">Cost per utility type</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overviewCostByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => formatCompact(Number(value))} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="totalCost" fill="#1476d6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
            {activityFeed.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No recent utility activity yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {activityFeed.map((activity) => (
                  <li key={activity.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{activity.kind}</p>
                      <p className="text-xs text-slate-500">{formatDate(activity.timestamp)}</p>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800">{activity.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{activity.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      ) : null}

      {activeTab === "meters" ? (
        <MeterTable
          meters={filteredMeters}
          search={meterSearch}
          typeFilter={meterTypeFilter}
          onSearchChange={setMeterSearch}
          onTypeFilterChange={setMeterTypeFilter}
          onAddMeter={openCreateMeterModal}
          onEditMeter={openEditMeterModal}
          onToggleMeterStatus={(meter) => void handleToggleMeterStatus(meter)}
          onOpenReadings={(meter) => {
            setSelectedMeterId(meter.id);
            setActiveTab("readings");
          }}
          canManage={canManage}
          isBusy={updateMeterMutation.isPending}
        />
      ) : null}

      {activeTab === "readings" ? (
        <section className="space-y-4">
          <ReadingTable
            readings={hydratedReadings}
            meters={meters}
            selectedMeterId={selectedMeterId}
            onSelectedMeterChange={setSelectedMeterId}
            onAddReading={openReadingModal}
            canManage={canManage}
          />

          {selectedMeter ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Consumption over time</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedMeter.meterNumber} at {selectedMeter.location}
                  </p>
                </div>
                <a
                  href={`/utilities/meters/${selectedMeter.id}`}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Open meter detail page
                </a>
              </div>

              {selectedMeterReadingChart.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No reading history available for this meter yet.</p>
              ) : (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedMeterReadingChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => formatCompact(Number(value))} />
                      <Tooltip formatter={(value: number) => formatCompact(value)} />
                      <Legend />
                      <Line dataKey="consumption" name="Consumption" stroke="#1476d6" strokeWidth={2.4} dot={false} />
                      <Line dataKey="readingValue" name="Reading value" stroke="#0e9aa7" strokeWidth={2.2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </article>
          ) : (
            <EmptyState title="No meter selected" description="Select a meter to see its consumption timeline." />
          )}
        </section>
      ) : null}

      {activeTab === "bills" ? (
        <BillsTable
          bills={hydratedBills}
          meters={meters}
          onGenerateBill={openBillModal}
          onMarkPaid={setPayConfirmTarget}
          onViewBreakdown={setBillDetailsTarget}
          canManage={canManage}
          payingBillId={markBillPaidMutation.isPending ? payConfirmTarget?.id ?? null : null}
        />
      ) : null}

      {activeTab === "analytics" ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Avg Consumption / Meter"
              value={`${formatQuantity(avgConsumptionPerMeter)} ${selectedMeter?.unit ?? ""}`.trim()}
              icon={<Droplets size={18} />}
              supportingText="Current month average"
            />
            <StatCard
              label="Highest Consuming Meter"
              value={highestConsumingMeter?.meterNumber ?? "-"}
              icon={<Building2 size={18} />}
              supportingText={
                highestConsumingMeter
                  ? `${formatQuantity(highestConsumingMeter.consumption)} units`
                  : "No consumption data"
              }
            />
            <StatCard
              label="Cost Spike Alert"
              value={costSpikeAlert ? "Detected" : "Normal"}
              icon={<AlertTriangle size={18} />}
              supportingText={
                costSpikeAlert
                  ? `${formatCurrency(costSpikeAlert.current)} this month`
                  : "No abnormal cost spikes"
              }
              trend={{
                direction: costSpikeAlert ? "up" : "flat",
                value: costSpikeAlert ? "Monitor" : "Stable"
              }}
            />
          </div>

          <AnalyticsCharts
            analytics={analytics}
            bills={hydratedBills}
            meters={meters}
            filters={analyticsFilters}
            onFiltersChange={setAnalyticsFilters}
          />
        </section>
      ) : null}

      <ModalShell
        open={meterModalState.open}
        title={meterModalState.mode === "create" ? "Add Utility Meter" : "Edit Utility Meter"}
        subtitle="Configure meter details used by readings and billing workflows."
        onClose={() => setMeterModalState({ open: false, mode: "create", meter: null })}
        footer={
          <>
            <button
              type="button"
              onClick={() => setMeterModalState({ open: false, mode: "create", meter: null })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveMeter()}
              disabled={createMeterMutation.isPending || updateMeterMutation.isPending}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {meterModalState.mode === "create" ? "Create meter" : "Save changes"}
            </button>
          </>
        }
      >
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <label className="text-sm text-slate-700">
            Meter number
            <input
              {...meterForm.register("meterNumber")}
              disabled={meterModalState.mode === "edit"}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder="MTR-101"
            />
            <span className="mt-1 block text-xs text-rose-600">{meterForm.formState.errors.meterNumber?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Utility type
            <select
              {...meterForm.register("type")}
              disabled={meterModalState.mode === "edit"}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="ELECTRICITY">Electricity</option>
              <option value="WATER">Water</option>
              <option value="GAS">Gas</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Location
            <input
              {...meterForm.register("location")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Tower A - Basement"
            />
            <span className="mt-1 block text-xs text-rose-600">{meterForm.formState.errors.location?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Unit
            <input
              {...meterForm.register("unit")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="kWh / Liters"
            />
            <span className="mt-1 block text-xs text-rose-600">{meterForm.formState.errors.unit?.message}</span>
          </label>

          <label className="text-sm text-slate-700 md:col-span-2">
            Description
            <textarea
              {...meterForm.register("description")}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Optional notes about this meter"
            />
          </label>
        </form>
      </ModalShell>

      <ModalShell
        open={readingModalOpen}
        title="Add Meter Reading"
        subtitle="Reading values must be non-decreasing for each meter."
        onClose={() => setReadingModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setReadingModalOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleAddReading()}
              disabled={createReadingMutation.isPending}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save reading
            </button>
          </>
        }
      >
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <label className="text-sm text-slate-700">
            Meter
            <select {...readingForm.register("meterId")} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select meter</option>
              {meters.map((meter) => (
                <option key={meter.id} value={meter.id}>
                  {meter.meterNumber} - {meter.location}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-rose-600">{readingForm.formState.errors.meterId?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Reading date
            <input
              type="date"
              {...readingForm.register("readingDate")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-rose-600">{readingForm.formState.errors.readingDate?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Reading value
            <input
              type="number"
              step="0.01"
              {...readingForm.register("readingValue", { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-rose-600">{readingForm.formState.errors.readingValue?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Image URLs
            <input
              {...readingForm.register("images")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="https://... (comma separated)"
            />
          </label>

          <label className="text-sm text-slate-700 md:col-span-2">
            Notes
            <textarea
              rows={3}
              {...readingForm.register("notes")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Optional notes"
            />
          </label>
        </form>
      </ModalShell>

      <ModalShell
        open={billModalOpen}
        title="Generate Utility Bill"
        subtitle="Create a bill using billed consumption and utility rates."
        onClose={() => setBillModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setBillModalOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreateBill()}
              disabled={createBillMutation.isPending}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create bill
            </button>
          </>
        }
      >
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <label className="text-sm text-slate-700">
            Meter
            <select {...billForm.register("meterId")} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select meter</option>
              {meters.map((meter) => (
                <option key={meter.id} value={meter.id}>
                  {meter.meterNumber} - {meter.location}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-rose-600">{billForm.formState.errors.meterId?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Due date
            <input type="date" {...billForm.register("dueDate")} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>

          <label className="text-sm text-slate-700">
            Billing start
            <input
              type="date"
              {...billForm.register("billingPeriodStart")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-rose-600">{billForm.formState.errors.billingPeriodStart?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Billing end
            <input
              type="date"
              {...billForm.register("billingPeriodEnd")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-rose-600">{billForm.formState.errors.billingPeriodEnd?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Total consumption
            <input
              type="number"
              step="0.01"
              {...billForm.register("totalConsumption", { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-rose-600">{billForm.formState.errors.totalConsumption?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Rate per unit
            <input
              type="number"
              step="0.01"
              {...billForm.register("ratePerUnit", { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-rose-600">{billForm.formState.errors.ratePerUnit?.message}</span>
          </label>

          <label className="text-sm text-slate-700">
            Base charge
            <input
              type="number"
              step="0.01"
              {...billForm.register("baseCharge", { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Tax amount
            <input
              type="number"
              step="0.01"
              {...billForm.register("taxAmount", { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700 md:col-span-2">
            Notes
            <textarea
              rows={3}
              {...billForm.register("notes")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Optional notes"
            />
          </label>
        </form>
      </ModalShell>

      <ModalShell
        open={Boolean(billDetailsTarget)}
        title="Bill Breakdown"
        subtitle={billDetailsTarget?.meter ? `${billDetailsTarget.meter.meterNumber} - ${billDetailsTarget.meter.location}` : "Utility bill details"}
        onClose={() => setBillDetailsTarget(null)}
        footer={
          <button
            type="button"
            onClick={() => setBillDetailsTarget(null)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Close
          </button>
        }
      >
        {billDetailsTarget ? (
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex justify-between">
              <span>Billing period</span>
              <span className="font-medium">
                {formatDate(billDetailsTarget.billingPeriodStart)} - {formatDate(billDetailsTarget.billingPeriodEnd)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Consumption</span>
              <span className="font-medium">
                {formatQuantity(billDetailsTarget.totalConsumption)} {billDetailsTarget.meter?.unit ?? ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Rate</span>
              <span className="font-medium">{formatCurrency(billDetailsTarget.ratePerUnit)}</span>
            </div>
            <div className="flex justify-between">
              <span>Base charge</span>
              <span className="font-medium">{formatCurrency(toNumber(billDetailsTarget.baseCharge))}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span className="font-medium">{formatCurrency(toNumber(billDetailsTarget.taxAmount))}</span>
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <div className="flex justify-between">
                <span>Total</span>
                <span>{formatCurrency(billDetailsTarget.totalAmount)}</span>
              </div>
            </div>
            <div className="pt-2">
              <StatusBadge label={getComputedBillStatus(billDetailsTarget)} toneClass={billStatusTone(getComputedBillStatus(billDetailsTarget))} />
            </div>
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={Boolean(payConfirmTarget)}
        title="Confirm payment"
        subtitle="This will mark the selected bill as paid."
        onClose={() => setPayConfirmTarget(null)}
        widthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPayConfirmTarget(null)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmPayBill()}
              disabled={markBillPaidMutation.isPending}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {markBillPaidMutation.isPending ? "Processing..." : "Mark as paid"}
            </button>
          </>
        }
      >
        {payConfirmTarget ? (
          <div className="text-sm text-slate-700">
            <p>
              Bill <span className="font-semibold">{payConfirmTarget.meter?.meterNumber ?? payConfirmTarget.id}</span> for
              <span className="ml-1 font-semibold">{formatCurrency(payConfirmTarget.totalAmount)}</span> will be marked as paid.
            </p>
          </div>
        ) : null}
      </ModalShell>
    </div>
  );
}
