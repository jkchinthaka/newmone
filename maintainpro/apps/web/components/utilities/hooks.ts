"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createUtilityBill,
  createUtilityMeter,
  createUtilityReading,
  fetchUtilityAnalytics,
  fetchUtilityBills,
  fetchUtilityMeters,
  fetchUtilityReadings,
  markUtilityBillPaid,
  updateUtilityMeter
} from "./api";
import type { BillFormValues, MeterFormValues, ReadingFormValues, UtilityMeter } from "./types";

export const UTILITY_METERS_QUERY_KEY = ["utilities", "meters"] as const;
export const UTILITY_READINGS_QUERY_KEY = ["utilities", "readings"] as const;
export const UTILITY_BILLS_QUERY_KEY = ["utilities", "bills"] as const;
export const UTILITY_ANALYTICS_QUERY_KEY = ["utilities", "analytics"] as const;

function invalidateUtilityQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: UTILITY_METERS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: UTILITY_READINGS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: UTILITY_BILLS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: UTILITY_ANALYTICS_QUERY_KEY });
}

export function useUtilityMetersQuery() {
  return useQuery({
    queryKey: UTILITY_METERS_QUERY_KEY,
    queryFn: fetchUtilityMeters,
    refetchInterval: 60_000
  });
}

export function useUtilityReadingsQuery() {
  return useQuery({
    queryKey: UTILITY_READINGS_QUERY_KEY,
    queryFn: fetchUtilityReadings,
    refetchInterval: 45_000,
    select: (rows) => [...rows].sort((a, b) => b.readingDate.localeCompare(a.readingDate))
  });
}

export function useUtilityBillsQuery() {
  return useQuery({
    queryKey: UTILITY_BILLS_QUERY_KEY,
    queryFn: fetchUtilityBills,
    refetchInterval: 45_000,
    select: (rows) => [...rows].sort((a, b) => b.billingPeriodStart.localeCompare(a.billingPeriodStart))
  });
}

export function useUtilityAnalyticsQuery() {
  return useQuery({
    queryKey: UTILITY_ANALYTICS_QUERY_KEY,
    queryFn: fetchUtilityAnalytics,
    refetchInterval: 90_000
  });
}

export function useCreateUtilityMeterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MeterFormValues) => createUtilityMeter(payload),
    onSuccess: () => {
      invalidateUtilityQueries(queryClient);
    }
  });
}

export function useUpdateUtilityMeterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Pick<UtilityMeter, "location" | "description" | "unit" | "isActive">> }) =>
      updateUtilityMeter(id, payload),
    onSuccess: () => {
      invalidateUtilityQueries(queryClient);
    }
  });
}

export function useCreateUtilityReadingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReadingFormValues) => createUtilityReading(payload),
    onSuccess: () => {
      invalidateUtilityQueries(queryClient);
    }
  });
}

export function useCreateUtilityBillMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BillFormValues) => createUtilityBill(payload),
    onSuccess: () => {
      invalidateUtilityQueries(queryClient);
    }
  });
}

export function useMarkBillPaidMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markUtilityBillPaid(id),
    onSuccess: () => {
      invalidateUtilityQueries(queryClient);
    }
  });
}
