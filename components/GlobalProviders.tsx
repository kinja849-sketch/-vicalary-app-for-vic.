"use client"
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import { CurrencyProvider } from "@/lib/CurrencyContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { GlobalShell } from "@/components/GlobalShell";

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <ErrorBoundary>
          <CurrencyProvider>
            <AuthProvider>
              <GlobalShell>{children}</GlobalShell>
            </AuthProvider>
          </CurrencyProvider>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
