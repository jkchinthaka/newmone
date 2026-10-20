"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { queryRetryDelay, shouldRetryQuery } from "@/lib/upstream-status";

export default function VendorLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: shouldRetryQuery,
            retryDelay: queryRetryDelay,
            refetchOnWindowFocus: false
          },
          mutations: { retry: false }
        }
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
