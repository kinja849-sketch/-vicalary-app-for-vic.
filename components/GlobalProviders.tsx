"use client"
import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import { CurrencyProvider } from "@/lib/CurrencyContext";
import { CallProvider } from "@/lib/CallContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { GlobalShell } from "@/components/GlobalShell";

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Suppress Plaid duplicate warning
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('The Plaid link-initialize.js script was embedded more than once')) return;
      originalWarn(...args);
    };

    // 2. Remove Netlify drawer / banner elements
    const selectors = [
      'netlify-drawer',
      '[data-netlify-drawer]',
      '[id*="netlify-drawer"]',
      '[class*="netlify-drawer"]',
      '[id*="netlify-feedback"]',
      '[class*="netlify-feedback"]',
      '.netlify-badge',
      '#netlify-badge',
      'iframe[src*="netlify"]',
      'iframe[title*="Netlify"]'
    ];

    const removeNetlifyElements = () => {
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });
    };

    removeNetlifyElements();
    const observer = new MutationObserver(removeNetlifyElements);
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    return () => {
      console.warn = originalWarn;
      observer.disconnect();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <ErrorBoundary>
          <CurrencyProvider>
            <AuthProvider>
              <CallProvider>
                <GlobalShell>{children}</GlobalShell>
              </CallProvider>
            </AuthProvider>
          </CurrencyProvider>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
