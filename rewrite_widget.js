const fs = require('fs');

const content = \"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useCurrency } from "@/lib/CurrencyContext";
import { useTranslation } from "@/lib/api/translation";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Landmark, CheckCircle2, Search } from "lucide-react";
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
    const { user, session } = useAuth();
    const { countryCode, formatCurrency } = useCurrency();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [banks, setBanks] = useState<Bank[]>([]);
    const [loadingBanks, setLoadingBanks] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Explicit Connection State Machine
    const [connectionState, setConnectionState] = useState<'loading' | 'ready' | 'starting' | 'authenticating' | 'processing' | 'connected' | 'failed'>('loading');
    
    const [plaidToken, setPlaidToken] = useState<string | null>(null);
    const [selectedInstitution, setSelectedInstitution] = useState<Bank | null>(null);
    const [connectedAccount, setConnectedAccount] = useState<any | null>(null);

    // On mount, handle callback URL parameters and verify connection
    useEffect(() => {
        const fetchUserBank = async () => {
            if (!user || !session) return;
            
            const connectionId = searchParams?.get('connection_id');
            const success = searchParams?.get('success');
            const errorParam = searchParams?.get('error');
            
            if (connectionId || success) {
                setConnectionState('processing');
                // Strip params from URL to prevent loop if user refreshes
                router.replace('/budget', { scroll: false });
            } else if (errorParam) {
                setConnectionState('failed');
                router.replace('/budget', { scroll: false });
            }
            
            try {
                const res = await fetch(\/api/banking/user-banks\, {
                    headers: { 'Authorization': \\\Bearer \\\\ }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.banks && data.banks.length > 0) {
                        setConnectedAccount(data.banks[0]);
                        setConnectionState('connected');
                    } else {
                        setConnectionState('ready');
                    }
                } else {
                    setConnectionState('failed');
                }
            } catch (err) {
                setConnectionState('failed');
            }
        };
        fetchUserBank();
    }, [user, session, searchParams, router]);

    useEffect(() => {
        const fetchBanks = async () => {
            if (!session) return;
            try {
                const res = await fetch(\/api/banking/institutions?country=\\, {
                    headers: {
                        'Authorization': \\\Bearer \\\\
                    }
                });
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
    }, [countryCode, session]);

    const handleConnect = async (bank: Bank) => {
        if (!user) return;
        setConnectionState('starting');
        setSelectedInstitution(bank);

        try {
            if (bank.provider === 'plaid' || ['US', 'CA'].includes(countryCode)) {
                // Initialize Plaid Link Flow
                const res = await fetch('/api/bank/link-token', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': \\\Bearer \\\\
                    }
                });
                const data = await res.json();
                
                if (res.ok && data.linkToken) {
                    setPlaidToken(data.linkToken);
                    setConnectionState('authenticating');
                } else {
                    toast.error(data.error || t('bank_secure_failed'));
                    setConnectionState('failed');
                }
            } else {
                // Strict Brankas Redirect Flow
                let endpoint = \/api/banking/\/create-link\;
                if (!['brankas', 'plaid'].includes(bank.provider)) endpoint = '/api/banking/brankas/create-link';
                
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, bankId: bank.id, countryCode })
                });
                const data = await res.json();
                
                if (data.success && data.account) {
                    setConnectedAccount(data.account);
                    setConnectionState('connected');
                    toast.success(t('bank_linked_success'));
                } else if (data.success && data.redirect_url) {
                    window.location.href = data.redirect_url;
                } else {
                    toast.error(data.error || t('bank_secure_failed'));
                    setConnectionState('failed');
                }
            }
        } catch (err: any) {
            toast.error(t('bank_network_error'));
            setConnectionState('failed');
        }
    };

    const handlePlaidSuccess = async (public_token: string, metadata: any) => {
        toast.loading(t('securing_bank_connection'), { id: 'plaid-exchange' });
        try {
            const res = await fetch('/api/bank/exchange-token', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': \\\Bearer \\\\
                },
                body: JSON.stringify({
                    publicToken: public_token,
                    providerId: 'plaid',
                    metadata
                })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                toast.success(t('bank_connected_success'), { id: 'plaid-exchange' });
                
                // Fetch the newly connected banks to update the UI
                const banksRes = await fetch(\/api/banking/user-banks\, {
                    headers: { 'Authorization': \\\Bearer \\\\ }
                });
                if (banksRes.ok) {
                    const banksData = await banksRes.json();
                    if (banksData.banks && banksData.banks.length > 0) {
                        setConnectedAccount(banksData.banks[0]);
                        setConnectionState('connected');
                    }
                }
            } else {
                toast.error(data.error || t('bank_secure_failed'), { id: 'plaid-exchange' });
                setConnectionState('failed');
            }
        } catch (err) {
            toast.error(t('bank_exchange_error'), { id: 'plaid-exchange' });
            setConnectionState('failed');
        } finally {
            setPlaidToken(null);
            setSelectedInstitution(null);
        }
    };

    const handlePlaidExit = () => {
        setPlaidToken(null);
        setSelectedInstitution(null);
        setConnectionState('ready');
    };

    const isConnecting = connectionState === 'starting' || connectionState === 'authenticating' || connectionState === 'processing';

    if (connectionState === 'connected' && connectedAccount) {
        return (
            <div className="bg-slate-50 dark:bg-[#1f2c34] p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 mb-8 animate-in fade-in zoom-in duration-500">
                <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 rounded-full bg-vic-green/20 flex items-center justify-center text-vic-green">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-vic-green">{t('approved')}</h3>
                        <p className="text-sm text-slate-500">
                            {connectedAccount.account_name || t('checking_account')} &bull; {connectedAccount.bank_name || t('open_banking')}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0d1418] p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6">
                    <p className="text-sm text-slate-500 mb-1">{t('available_balance')}</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                        {formatCurrency(connectedAccount.balance)}
                    </p>
                </div>
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
                                type="button"
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
\;

fs.writeFileSync('components/BankConnectionWidget.tsx', content);
console.log('Successfully wrote BankConnectionWidget.tsx');
