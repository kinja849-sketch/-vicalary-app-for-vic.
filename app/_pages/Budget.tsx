"use client"
import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getActiveBudget, createBudget, getBudgetHistory, deleteBudget } from "@/lib/api/budget";
import { useTranslation } from "@/lib/api/translation";
import { useCurrency } from "@/lib/CurrencyContext";
import { toast } from "sonner";
import { ArrowLeft, PlusCircle, Wallet, Trash2 } from "lucide-react";
import { BankConnectionWidget } from "@/components/BankConnectionWidget";
import { getDynamicDailyBudget } from "@/lib/services/BudgetEngine";

export default function Budget() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { t } = useTranslation();
    const { currencyCode, currencySymbol, formatCurrency } = useCurrency();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newBudget, setNewBudget] = useState({
        amount: 500,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });

    // Fetch active budget
    const { data: activeBudget, isLoading: budgetLoading } = useQuery({
        queryKey: ['active-budget', user?.id],
        queryFn: () => getActiveBudget(user!.id),
        enabled: !!user?.id
    });

    // Fetch budget history
    const { data: history } = useQuery({
        queryKey: ['budget-history', user?.id],
        queryFn: () => getBudgetHistory(user!.id),
        enabled: !!user?.id
    });

    // Create budget mutation
    const createBudgetMutation = useMutation({
        mutationFn: (data: any) => createBudget(user!.id, data.amount, data.startDate, data.endDate, currencyCode, currencySymbol),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-budget', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['budget-history', user?.id] });
            setShowCreateModal(false);
            toast.success(t('scan_success')); // Or generic success
        },
        onError: (error: any) => {
            toast.error(`${t('auth_error')}: ${error.message}`);
        }
    });

    // Adjust default amount based on currency
    useEffect(() => {
        if (!activeBudget) {
            // Scale default amount for currencies with large denominations (like IDR)
            const defaultAmt = currencySymbol === 'Rp' ? 5000000 : 500;
            setNewBudget(prev => ({ ...prev, amount: defaultAmt }));
        }
    }, [currencySymbol, activeBudget]);

    const handleCreateBudget = (e: React.FormEvent) => {
        e.preventDefault();
        createBudgetMutation.mutate({ ...newBudget });
    };

    const handleDeleteBudget = async (id: string) => {
        if (window.confirm(t('confirm_delete'))) {
            try {
                await deleteBudget(id);
                queryClient.invalidateQueries({ queryKey: ['active-budget', user?.id] });
                queryClient.invalidateQueries({ queryKey: ['budget-history', user?.id] });
                toast.success(t('delete'));
            } catch (err: any) {
                toast.error(`${t('auth_error')}: ${err.message}`);
            }
        }
    };

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
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="text-vic-green"
                >
                    <PlusCircle size={22} />
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-6">
                {/* Active Budget Card */}
                {activeBudget ? (
                    <div className="bg-gradient-to-br from-vic-deep-blue to-vic-blue p-6 rounded-2xl text-white shadow-xl mb-8">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-white/70 text-sm">{t('remaining_balance')}</p>
                                <h2 className="text-4xl font-bold">{formatCurrency(activeBudget.remaining_budget || 0)}</h2>
                            </div>
                            <div className="bg-white/20 px-3 py-1 rounded-full text-xs">
                                {t('active')}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white/10 rounded-xl p-4 flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-white/70 uppercase tracking-widest font-bold">{t('dynamic_daily_target')}</p>
                                    <p className="text-xl font-bold text-vic-green">{formatCurrency(getDynamicDailyBudget(activeBudget))}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-white/70 uppercase tracking-widest font-bold">{t('health_coaching')}</p>
                                    <p className="text-xs font-bold text-white">{t('active')}</p>
                                </div>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{t('total_budget')}: {formatCurrency(activeBudget.total_budget)}</span>
                                <span>{Math.round(((activeBudget.remaining_budget || 0) / activeBudget.total_budget) * 100)}% {t('left')}</span>
                            </div>
                            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-vic-green h-full transition-all duration-500"
                                    style={{ width: `${((activeBudget.remaining_budget || 0) / activeBudget.total_budget) * 100}%` }}
                                />
                            </div>
                            <p className="text-white/60 text-xs pt-2">
                                {t('active_period')}: {new Date(activeBudget.period_start).toLocaleDateString()} - {new Date(activeBudget.period_end).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                ) : (
                    <BankConnectionWidget />
                )}

                {/* History */}
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('budget_history')}</h3>
                <div className="space-y-4">
                    {history?.map((item: any) => (
                        <div key={item.id} className="p-4 bg-white dark:bg-[#1f2c34] rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.total_budget)}</p>
                                <p className="text-xs text-slate-500">{new Date(item.period_start).toLocaleDateString()} - {new Date(item.period_end).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`text-sm font-medium ${item.is_active ? 'text-vic-green' : 'text-slate-400'}`}>
                                    {item.is_active ? t('active') : t('completed')}
                                </span>
                                <button
                                    onClick={() => handleDeleteBudget(item.id)}
                                    className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1f2c34] w-full max-w-md rounded-2xl p-6 shadow-2xl">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('new_budget')}</h2>
                        <form onSubmit={handleCreateBudget} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('total_amount_label')} ({currencySymbol})</label>
                                <input
                                    type="number"
                                    value={newBudget.amount}
                                    onChange={(e) => setNewBudget({ ...newBudget, amount: Number(e.target.value) })}
                                    className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1418] text-slate-900 dark:text-white text-lg font-bold focus:border-vic-green outline-none transition-all"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('start_date')}</label>
                                    <input
                                        type="date"
                                        value={newBudget.startDate}
                                        onChange={(e) => setNewBudget({ ...newBudget, startDate: e.target.value })}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1418] text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('end_date')}</label>
                                    <input
                                        type="date"
                                        value={newBudget.endDate}
                                        onChange={(e) => setNewBudget({ ...newBudget, endDate: e.target.value })}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1418] text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold"
                                >
                                    {t('cancel_btn')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={createBudgetMutation.isPending}
                                    className="flex-1 py-3 bg-vic-green text-slate-900 rounded-xl font-bold disabled:opacity-50"
                                >
                                    {createBudgetMutation.isPending ? t('creating_account') : t('create_btn')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
