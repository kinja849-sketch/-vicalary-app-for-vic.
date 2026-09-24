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
                        <h2 className="text-lg font-bold text-red-700 dark:text-red-400">Budget Profile Missing</h2>
                        <p className="text-sm text-red-600 dark:text-red-300 mb-4">You have not completed your onboarding budget setup. Please complete onboarding to set your intended monthly spending goal.</p>
                    </div>
                ) : (
                    <div className="bg-gradient-to-br from-vic-green to-teal-500 p-6 rounded-2xl mb-8 shadow-sm text-slate-900 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-20">
                            <Wallet size={120} />
                        </div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-sm font-bold opacity-80 uppercase tracking-wider">Daily Allowance</p>
                                <p className="text-xs font-semibold opacity-90">{activeBudget.currentDateStr}</p>
                            </div>
                            <h2 className="text-4xl font-black mb-6">
                                {formatBudgetCurrency(activeBudget.recommendedDailySpend)}
                            </h2>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                    <p className="text-xs font-bold opacity-80 uppercase mb-1">Spent Today</p>
                                    <p className="font-black text-lg">{formatBudgetCurrency(activeBudget.spentToday)}</p>
                                </div>
                                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                    <p className="text-xs font-bold opacity-80 uppercase mb-1">Remaining Today</p>
                                    <p className="font-black text-lg">{formatBudgetCurrency(activeBudget.remainingToday)}</p>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-white/20">
                                <div className="flex justify-between mb-2">
                                    <p className="text-xs font-bold opacity-80 uppercase">Monthly Cycle Overview</p>
                                    <p className="text-xs font-bold opacity-80">{activeBudget.daysRemaining} days left in cycle</p>
                                </div>
                                <div className="w-full bg-white/30 h-2 rounded-full overflow-hidden mb-2">
                                    <div 
                                        className={`h-full ${activeBudget.status === 'over_budget' ? 'bg-red-500' : 'bg-white'}`} 
                                        style={{ width: `${Math.min(100, activeBudget.percentUsed)}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-xs font-bold opacity-90">
                                    <span>Spent: {formatBudgetCurrency(activeBudget.spentThisMonth)}</span>
                                    <span>Total: {formatBudgetCurrency(activeBudget.monthlyBudget)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Alerts */}
                {activeBudget && activeBudget.status === 'warning' && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl mb-6 border border-yellow-200 dark:border-yellow-800 flex items-start gap-3">
                        <AlertTriangle className="text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h3 className="font-bold text-yellow-800 dark:text-yellow-500">⚠ Budget Alert</h3>
                            <p className="text-sm text-yellow-700 dark:text-yellow-600 mt-1">
                                You have spent {activeBudget.percentUsed.toFixed(0)}% of your monthly budget.
                            </p>
                        </div>
                    </div>
                )}

                {activeBudget && activeBudget.remainingToday <= (activeBudget.recommendedDailySpend * 0.1) && activeBudget.remainingToday > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl mb-6 border border-orange-200 dark:border-orange-800 flex items-start gap-3">
                        <AlertTriangle className="text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h3 className="font-bold text-orange-800 dark:text-orange-500">⚠ Approaching Limit</h3>
                            <p className="text-sm text-orange-700 dark:text-orange-600 mt-1">
                                You are approaching your daily budget. Remaining: {formatBudgetCurrency(activeBudget.remainingToday)}.
                            </p>
                        </div>
                    </div>
                )}

                {activeBudget && activeBudget.remainingToday === 0 && activeBudget.spentToday > activeBudget.recommendedDailySpend && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl mb-6 border border-red-200 dark:border-red-800 flex items-start gap-3">
                        <AlertTriangle className="text-red-600 dark:text-red-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h3 className="font-bold text-red-800 dark:text-red-500">Daily budget exceeded</h3>
                            <p className="text-sm text-red-700 dark:text-red-600 mt-1 mb-2">
                                Daily limit: {formatBudgetCurrency(activeBudget.recommendedDailySpend)}<br/>
                                Spent: {formatBudgetCurrency(activeBudget.spentToday)}<br/>
                                Exceeded by: {formatBudgetCurrency(activeBudget.spentToday - activeBudget.recommendedDailySpend)}
                            </p>
                            {/* AI Advice Placeholder */}
                            <div className="mt-3 p-3 bg-white/60 dark:bg-black/20 rounded-lg text-sm italic text-slate-700 dark:text-slate-300">
                                🤖 "Since you've spent above your target today, consider opting for home-cooked meals tomorrow to bring your weekly average back down!"
                            </div>
                        </div>
                    </div>
                )}

                {/* Recent Scanned Items */}
                {activeBudget && (
                    <div className="mt-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Scanned Products</h3>
                        {activeBudget.recentExpenses?.length > 0 ? (
                            <div className="space-y-3">
                                {activeBudget.recentExpenses.map((expense: any, idx: number) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-4 rounded-xl flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">{expense.merchant_name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Scanned today</p>
                                        </div>
                                        <div className="font-black text-vic-green">
                                            {formatBudgetCurrency(expense.amount)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-8 rounded-xl text-center">
                                <p className="text-slate-500 dark:text-slate-400">No products scanned today.</p>
                                <p className="text-xs text-slate-400 mt-2">Use the scanner feature to automatically deduct expenses from your budget.</p>
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
