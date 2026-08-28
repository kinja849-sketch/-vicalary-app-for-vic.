"use client"
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { getBudgetStatus, getBudgetHistory } from "@/lib/api/budget";
import { useTranslation } from "@/lib/api/translation";
import { useCurrency } from "@/lib/CurrencyContext";
import { ArrowLeft, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BankConnectionWidget } from "@/components/BankConnectionWidget";

export default function Budget() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const { formatCurrency } = useCurrency();

    // Fetch active budget using deterministic BudgetEngine
    const { data: activeBudget, isLoading: budgetLoading, isError } = useQuery({
        queryKey: ['active-budget', user?.id],
        queryFn: () => getBudgetStatus(user!.id),
        enabled: !!user?.id,
        retry: false
    });

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
                            <p className="text-sm font-bold opacity-80 uppercase tracking-wider mb-1">Recommended Daily Allowance</p>
                            <h2 className="text-4xl font-black mb-6">
                                {formatCurrency(activeBudget.recommendedDailySpend)}
                            </h2>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                    <p className="text-xs font-bold opacity-80 uppercase mb-1">Spent Today</p>
                                    <p className="font-black text-lg">{formatCurrency(activeBudget.spentToday)}</p>
                                </div>
                                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                    <p className="text-xs font-bold opacity-80 uppercase mb-1">Remaining Today</p>
                                    <p className="font-black text-lg">{formatCurrency(activeBudget.remainingToday)}</p>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-white/20">
                                <p className="text-xs font-bold opacity-80 uppercase mb-2">Monthly Overview ({activeBudget.daysRemaining} days left)</p>
                                <div className="w-full bg-white/30 h-2 rounded-full overflow-hidden mb-2">
                                    <div 
                                        className={`h-full ${activeBudget.status === 'over_budget' ? 'bg-red-500' : 'bg-white'}`} 
                                        style={{ width: `${Math.min(100, activeBudget.percentUsed)}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-xs font-bold opacity-90">
                                    <span>Spent: {formatCurrency(activeBudget.spentThisMonth)}</span>
                                    <span>Total: {formatCurrency(activeBudget.monthlyBudget)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <BankConnectionWidget />
                
            </main>
        </div>
    );
}
