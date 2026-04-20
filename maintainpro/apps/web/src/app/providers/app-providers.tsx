import { type ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { queryClient } from "@/lib/query-client";

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: "10px",
            border: "1px solid #99f6e4"
          }
        }}
      />
    </QueryClientProvider>
  );
};
