"use client"
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useCurrency } from "@/lib/CurrencyContext";
import { getBudgetStatus } from "@/lib/api/budget";
import { useTranslation } from "@/lib/api/translation";
import { ArrowLeft, Wallet, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useCallback } from "react";

// Zero-decimal currencies that should not show fractional amounts
const ZERO_DECIMAL_CURRENCIES = ['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'HUF'];

export default function Budget() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const { currencyCode: clientCurrency, countryCode: clientCountry } = useCurrency();
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    // Fetch active budget using deterministic BudgetEngine
    const { data: activeBudget, isLoading: budgetLoading, isError } = useQuery({
        queryKey: ['active-budget', user?.id, clientCurrency],
        queryFn: () => getBudgetStatus(user!.id, clientCurrency, clientCountry),
        enabled: !!user?.id,
        retry: false,
        staleTime: 0,          // Always re-fetch on mount to get fresh data
        refetchOnMount: 'always',
    });

    /**
     * Format currency using the API-returned currency code (authoritative).
     * This ensures the displayed currency matches the currency the budget
     * was calculated in, rather than relying on CurrencyContext.
     */
    const formatBudgetCurrency = useCallback((amount: number | string) => {
        const numericAmount = typeof amount === 'string'
            ? parseFloat(amount.replace(/[^0-9.-]+/g, ""))
            : amount;
        const symbol = activeBudget?.currencySymbol || '$';
        const separator = symbol === 'Rp' ? ' ' : '';
        if (isNaN(numericAmount)) return `${symbol}${separator}0`;

        const currencyCode = activeBudget?.currency || 'USD';
        const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currencyCode);
        const hasDecimals = !isZeroDecimal && numericAmount % 1 !== 0;

        const formattedNumber = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: hasDecimals ? 2 : 0,
            maximumFractionDigits: hasDecimals ? 2 : 0,
        }).format(numericAmount);

        return `${symbol}${separator}${formattedNumber}`;
    }, [activeBudget?.currency, activeBudget?.currencySymbol]);

    if (budgetLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0d1418]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vic-green"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen max-w-2xl mx-auto w-full bg-white dark:bg-[#0d1418]">
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 bg-white dark:bg-[#0d1418]">
                <Link href="/dashboard" className="flex items-center gap-2 text-vic-deep-blue dark:text-vic-green font-bold">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('budget')}</h1>
                <div className="w-6" />
            </header>

            <main className="flex-1 overflow-y-auto p-4 pb-20 custom-scrollbar">
                
                {isError || !activeBudget ? (
                    <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl mb-8 border border-red-100 dark:border-red-800">
                        <AlertTriangle className="text-red-500 mb-2" />
                        <h2 className="text-lg font-bold text-red-700 dark:text-red-400">{t('budget_profile_missing')}</h2>
                        <p className="text-sm text-red-600 dark:text-red-300 mb-4">{t('budget_profile_missing_desc')}</p>
                    </div>
                ) : (
                    <>
                        {/* 🚨 CRITICAL BUDGET EXCEEDED ALERT */}
                        {activeBudget.spentToday > activeBudget.recommendedDailySpend && (
                            <div className="bg-rose-500/15 border-2 border-rose-500/40 rounded-2xl p-5 mb-6 shadow-lg animate-in fade-in slide-in-from-top-2 flex items-start gap-4">
                                <div className="size-11 rounded-2xl bg-rose-500/25 border border-rose-500/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                                    <AlertTriangle className="size-6 text-rose-600 dark:text-rose-400 animate-pulse" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                        <h3 className="text-base font-black text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                                            {t('daily_budget_alert')}
                                        </h3>
                                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-black uppercase tracking-wider">
                                            {t('over_allowance')}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
                                        {t('exceeded_daily_allowance')}{" "}
                                        <span className="font-black underline text-rose-600 dark:text-rose-300">
                                            {formatBudgetCurrency(activeBudget.spentToday - activeBudget.recommendedDailySpend)}
                                        </span>
                                        !
                                    </p>
                                    <div className="mt-3 p-3 bg-white/70 dark:bg-black/40 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 border border-rose-500/20 grid grid-cols-3 gap-2">
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400 block font-bold uppercase text-[10px]">{t('daily_limit')}</span>
                                            <span className="font-black text-slate-900 dark:text-white">{formatBudgetCurrency(activeBudget.recommendedDailySpend)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400 block font-bold uppercase text-[10px]">{t('total_spent')}</span>
                                            <span className="font-black text-rose-600 dark:text-rose-400">{formatBudgetCurrency(activeBudget.spentToday)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400 block font-bold uppercase text-[10px]">{t('remaining')}</span>
                                            <span className="font-black text-rose-600 dark:text-rose-400">{formatBudgetCurrency(0)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DAILY BUDGET CARD */}
                        <div className="bg-gradient-to-br from-vic-green to-teal-500 p-6 rounded-3xl mb-8 shadow-sm text-slate-900 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                            <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-20 pointer-events-none">
                                <Wallet size={120} />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm font-bold opacity-80 uppercase tracking-wider">{t('daily_budget_label')}</p>
                                    <p className="text-xs font-semibold opacity-90">{activeBudget.currentDateStr}</p>
                                </div>
                                <h2 className="text-4xl font-black mb-6">
                                    {formatBudgetCurrency(activeBudget.remainingToday)}
                                </h2>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        <p className="text-xs font-bold opacity-80 uppercase mb-1">{t('daily_allowance_label')}</p>
                                        <p className="font-black text-lg">{formatBudgetCurrency(activeBudget.recommendedDailySpend)}</p>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        <p className="text-xs font-bold opacity-80 uppercase mb-1">{t('spent_today')}</p>
                                        <p className="font-black text-lg">{formatBudgetCurrency(activeBudget.spentToday)}</p>
                                    </div>
                                </div>
                                
                                <div className="mt-6 pt-4 border-t border-white/20">
                                    <div className="flex justify-between mb-2">
                                        <p className="text-xs font-bold opacity-80 uppercase">{t('monthly_cycle_overview')}</p>
                                        <p className="text-xs font-bold opacity-80">{activeBudget.daysRemaining} {t('days_left_cycle')}</p>
                                    </div>
                                    <div className="w-full bg-white/30 h-2 rounded-full overflow-hidden mb-2">
                                        <div 
                                            className={`h-full ${activeBudget.status === 'over_budget' ? 'bg-red-500' : 'bg-white'}`} 
                                            style={{ width: `${Math.min(100, activeBudget.percentUsed)}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold opacity-90">
                                        <span>{t('budget_spent')}: {formatBudgetCurrency(activeBudget.spentThisMonth)}</span>
                                        <span>{t('budget_total')}: {formatBudgetCurrency(activeBudget.monthlyBudget)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Status Alerts */}
                {activeBudget && activeBudget.status === 'warning' && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl mb-6 border border-yellow-200 dark:border-yellow-800 flex items-start gap-3">
                        <AlertTriangle className="text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h3 className="font-bold text-yellow-800 dark:text-yellow-500">⚠ {t('budget_warning_alert')}</h3>
                            <p className="text-sm text-yellow-700 dark:text-yellow-600 mt-1">
                                {activeBudget.percentUsed.toFixed(0)}%
                            </p>
                        </div>
                    </div>
                )}

                {activeBudget && activeBudget.remainingToday <= (activeBudget.recommendedDailySpend * 0.1) && activeBudget.remainingToday > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl mb-6 border border-orange-200 dark:border-orange-800 flex items-start gap-3">
                        <AlertTriangle className="text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h3 className="font-bold text-orange-800 dark:text-orange-500">⚠ {t('approaching_limit')}</h3>
                            <p className="text-sm text-orange-700 dark:text-orange-600 mt-1">
                                {t('approaching_daily_budget')} {formatBudgetCurrency(activeBudget.remainingToday)}.
                            </p>
                        </div>
                    </div>
                )}

                {/* Recent Scanned Items */}
                {activeBudget && (
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('recent_scanned_products')}
                            </h3>
                            {activeBudget.recentExpenses?.length > 0 && (
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {activeBudget.recentExpenses.length} {t('deducted_today')}
                                </span>
                            )}
                        </div>

                        {activeBudget.recentExpenses?.length > 0 ? (
                            <div className="space-y-3">
                                {activeBudget.recentExpenses.map((expense: any, idx: number) => {
                                    const txDate = expense.transaction_date ? new Date(expense.transaction_date) : null;
                                    const timeStr = txDate ? txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today';
                                    return (
                                        <div 
                                            key={idx} 
                                            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                                                    <span className="text-base font-black">−</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                                                        {expense.merchant_name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                        {t('deducted_today_at')} {timeStr}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-rose-600 dark:text-rose-400 text-base">
                                                    − {formatBudgetCurrency(expense.amount)}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    {t('deduction')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-8 rounded-2xl text-center">
                                <p className="text-slate-500 dark:text-slate-400 font-medium">No products scanned today.</p>
                                <p className="text-xs text-slate-400 mt-2">Use the barcode scanner to automatically deduct purchases from your daily allowance.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Dev Diagnostics Panel */}
                {activeBudget?.diagnostics && (
                    <div className="mt-8 mb-4">
                        <button
                            onClick={() => setShowDiagnostics(!showDiagnostics)}
                            className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            🔧 Budget Pipeline Diagnostics
                        </button>
                        {showDiagnostics && (
                            <div className="mt-2 bg-slate-900 text-green-400 p-4 rounded-xl text-xs font-mono overflow-x-auto">
                                <pre>{JSON.stringify(activeBudget.diagnostics, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                )}
                
            </main>
        </div>
    );
}
