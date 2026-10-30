"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LiveQueryInvalidator } from "@/components/pwa/live-query-invalidator";
import { useState, type ReactNode } from "react";

import { APP_QUERY_DEFAULT_OPTIONS } from "@/lib/query-client-defaults";

export default function VendorLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: APP_QUERY_DEFAULT_OPTIONS })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LiveQueryInvalidator />
      {children}
    </QueryClientProvider>
  );
}
