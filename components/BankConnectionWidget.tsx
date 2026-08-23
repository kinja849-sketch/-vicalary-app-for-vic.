"use client"
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useCurrency } from "@/lib/CurrencyContext";
import { useTranslation } from "@/lib/api/translation";
import { createBudget } from "@/lib/api/budget";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Landmark, ArrowRight, CheckCircle2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { usePlaidLink } from 'react-plaid-link';

interface Bank {
    id: string;
    name: string;
    logo: string;
    provider: string;
}

const PlaidLinkHandler = ({ token, onSuccess, onExit }: { token: string, onSuccess: (public_token: string, metadata: any) => void, onExit: () => void }) => {
    const { open, ready } = usePlaidLink({
        token,
        onSuccess,
        onExit,
    });

    useEffect(() => {
        if (ready) {
            open();
        }
    }, [ready, open]);

    return null;
};

export const BankConnectionWidget = () => {
    const { user } = useAuth();
    const { countryCode, currencyCode, currencySymbol, formatCurrency } = useCurrency();
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const [banks, setBanks] = useState<Bank[]>([]);
    const [loadingBanks, setLoadingBanks] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Flow States
    const [step, setStep] = useState<'SELECT' | 'CONNECTED'>('SELECT');
    const [isConnecting, setIsConnecting] = useState(false);
    
    // Plaid States
    const [plaidToken, setPlaidToken] = useState<string | null>(null);
    const [selectedInstitution, setSelectedInstitution] = useState<Bank | null>(null);

    const [connectedAccount, setConnectedAccount] = useState<any | null>(null);
    const [allocation, setAllocation] = useState<string>("");
    const [isCreatingBudget, setIsCreatingBudget] = useState(false);

    // On mount, check if user already has a bank connected in the database
    useEffect(() => {
        const fetchUserBank = async () => {
            if (!user) return;
            const res = await fetch(`/api/banking/user-banks?userId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.banks && data.banks.length > 0) {
                    setConnectedAccount(data.banks[0]);
                    setStep('CONNECTED');
                }
            }
        };
        fetchUserBank();
    }, [user]);

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const res = await fetch(`/api/banking/institutions?country=${countryCode}`);
                const data = await res.json();
                if (data.success) {
                    setBanks(data.banks);
                }
            } catch (err) {
                console.error("Failed to fetch banks", err);
            } finally {
                setLoadingBanks(false);
            }
        };
        fetchBanks();
    }, [countryCode]);

    const handleConnect = async (bank: Bank) => {
        if (!user) return;
        setIsConnecting(true);
        setSelectedInstitution(bank);

        try {
            if (bank.provider === 'plaid' || ['US', 'CA'].includes(countryCode)) {
                // Initialize Plaid Link Flow
                const res = await fetch('/api/banking/plaid/create-link-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id })
                });
                const data = await res.json();
                
                if (data.success && data.link_token) {
                    setPlaidToken(data.link_token);
                    setIsConnecting(false);
                } else {
                    toast.error(data.error || t('bank_secure_failed'));
                    setIsConnecting(false);
                }
            } else {
                // Strict Brankas Redirect Flow
                let endpoint = `/api/banking/${bank.provider}/create-link`;
                if (!['brankas', 'plaid'].includes(bank.provider)) endpoint = '/api/banking/brankas/create-link';
                
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, bankId: bank.id, countryCode })
                });
                const data = await res.json();
                
                if (data.success && data.account) {
                    setConnectedAccount(data.account);
                    setStep('CONNECTED');
                    toast.success(t('bank_linked_success'));
                } else if (data.success && data.redirect_url) {
                    window.location.href = data.redirect_url;
                } else {
                    toast.error(data.error || t('bank_secure_failed'));
                    setIsConnecting(false);
                }
            }
        } catch (err: any) {
            toast.error(t('bank_network_error'));
            setIsConnecting(false);
        }
    };

    const handlePlaidSuccess = async (public_token: string, metadata: any) => {
        toast.loading(t('securing_bank_connection'), { id: 'plaid-exchange' });
        try {
            const res = await fetch('/api/banking/plaid/exchange-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    public_token,
                    userId: user?.id,
                    institution_id: selectedInstitution?.id,
                    institution_name: selectedInstitution?.name || metadata.institution?.name
                })
            });
            const data = await res.json();
            
            if (data.success) {
                toast.success(t('bank_connected_success'), { id: 'plaid-exchange' });
                setConnectedAccount(data.account);
                setStep('CONNECTED');
            } else {
                toast.error(t('bank_secure_failed'), { id: 'plaid-exchange' });
            }
        } catch (err) {
            toast.error(t('bank_exchange_error'), { id: 'plaid-exchange' });
        } finally {
            setPlaidToken(null);
            setSelectedInstitution(null);
        }
    };

    const handlePlaidExit = () => {
        setPlaidToken(null);
        setSelectedInstitution(null);
    };

    const handleAllocate = async () => {
        if (!user || !connectedAccount) return;
        const amount = Number(allocation);
        if (isNaN(amount) || amount <= 0 || amount > connectedAccount.balance) {
            toast.error(t('bank_valid_amount'));
            return;
        }

        setIsCreatingBudget(true);
        try {
            const startDate = new Date().toISOString().split('T')[0];
            const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            await createBudget(user.id, amount, startDate, endDate, currencyCode, currencySymbol);
            
            toast.success(t('budget_allocated_success'));
            queryClient.invalidateQueries({ queryKey: ['active-budget', user.id] });
            queryClient.invalidateQueries({ queryKey: ['budget-history', user.id] });
        } catch (err: any) {
            toast.error(t('budget_allocation_failed').replace('%s', err.message));
        } finally {
            setIsCreatingBudget(false);
        }
    };

    const dailyBudget = allocation ? (Number(allocation) / 30).toFixed(2) : 0;

    if (step === 'CONNECTED' && connectedAccount) {
        return (
            <div className="bg-slate-50 dark:bg-[#1f2c34] p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 mb-8 animate-in fade-in zoom-in duration-500">
                <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 rounded-full bg-vic-green/20 flex items-center justify-center text-vic-green">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-vic-green">{t('approved')}</h3>
                        <p className="text-sm text-slate-500">
                            {connectedAccount.account_name || t('checking_account')} • {connectedAccount.bank_name || t('open_banking')}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0d1418] p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6">
                    <p className="text-sm text-slate-500 mb-1">{t('available_balance')}</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                        {formatCurrency(connectedAccount.balance)}
                    </p>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                    {t('bank_allocate_prompt')}
                </h4>
                
                <div className="flex gap-3 mb-6">
                    <input
                        type="number"
                        value={allocation}
                        onChange={(e) => setAllocation(e.target.value)}
                        placeholder={`e.g. ${connectedAccount.balance > 1000 ? '500' : '50'}`}
                        className="flex-1 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1418] text-slate-900 dark:text-white outline-none focus:border-vic-green transition-colors"
                    />
                    <button
                        onClick={handleAllocate}
                        disabled={isCreatingBudget || !allocation}
                        className="px-6 bg-vic-green text-slate-900 font-bold rounded-xl flex items-center gap-2 hover:bg-opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {isCreatingBudget ? <Loader2 size={20} className="animate-spin" /> : t('allocate')}
                        {!isCreatingBudget && <ArrowRight size={18} />}
                    </button>
                </div>

                {Number(allocation) > 0 && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
                        <div>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">{t('daily_allowance')}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{t('based_on_30_day')}</p>
                        </div>
                        <p className="text-2xl font-black text-blue-900 dark:text-blue-100">{formatCurrency(Number(dailyBudget))}</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-[#1f2c34] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 mb-8 shadow-sm relative">
            {plaidToken && (
                <PlaidLinkHandler 
                    token={plaidToken} 
                    onSuccess={handlePlaidSuccess} 
                    onExit={handlePlaidExit} 
                />
            )}

            <div className="flex items-center gap-2 mb-2 text-vic-green font-bold text-sm uppercase tracking-wider">
                <ShieldCheck size={18} />
                {t('secure_open_banking')}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('connect_your_bank')}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                {t('bank_connect_desc')}
            </p>

            <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={18} className="text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder={t('search_bank_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1418] text-slate-900 dark:text-white outline-none focus:border-vic-green focus:ring-1 focus:ring-vic-green transition-all"
                />
            </div>

            {loadingBanks ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 animate-pulse">
                            <div className="size-10 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {banks.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                        <div className="col-span-1 sm:col-span-2 text-center py-8 text-slate-500">
                            {t('no_institutions_found').replace('%s', searchTerm)}
                        </div>
                    ) : (
                        banks.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())).map((bank) => (
                            <button
                                key={bank.id}
                                onClick={() => handleConnect(bank)}
                                disabled={isConnecting || plaidToken !== null}
                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-vic-green dark:hover:border-vic-green transition-colors text-left group disabled:opacity-50"
                            >
                                <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 relative">
                                    {bank.logo ? (
                                        <img 
                                            src={bank.logo} 
                                            alt={bank.name} 
                                            className="w-full h-full object-contain p-1.5" 
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement?.classList.add('fallback-icon');
                                            }}
                                        />
                                    ) : null}
                                    <Landmark className="text-slate-400 absolute inset-0 m-auto -z-10 [.fallback-icon_&]:z-10" size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-vic-green transition-colors line-clamp-1">
                                        {bank.name}
                                    </p>
                                    <p className="text-[10px] text-slate-500 uppercase">{t('via_secure_connection')}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
