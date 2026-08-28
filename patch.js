const fs = require('fs');

let content = fs.readFileSync('components/BankConnectionWidget.tsx', 'utf8');

// 1. Add imports
content = content.replace('import { useState, useEffect } from "react";', 'import { useState, useEffect } from "react";\nimport { useSearchParams, useRouter } from "next/navigation";');

// 2. Add hooks
content = content.replace('const queryClient = useQueryClient();', 'const queryClient = useQueryClient();\n    const searchParams = useSearchParams();\n    const router = useRouter();');

// 3. Replace state machine and mount logic
const newLogic = \
    const [banks, setBanks] = useState<Bank[]>([]);
    const [loadingBanks, setLoadingBanks] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Explicit Connection State Machine
    const [connectionState, setConnectionState] = useState<'loading' | 'ready' | 'starting' | 'authenticating' | 'processing' | 'connected' | 'failed'>('loading');
    
    // Plaid States
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
    }, [user, session, searchParams, router]);\;

// Replace from 'const [banks' down to 'fetchUserBank();\\n    }, [user, session]);'
const regex = /const \[banks.*?fetchUserBank\(\);\s*\}, \[user, session\]\);/s;
content = content.replace(regex, newLogic);

// 4. Update isConnecting logic
content = content.replace(/setIsConnecting\(true\)/g, "setConnectionState('starting')");
content = content.replace(/setIsConnecting\(false\)/g, "setConnectionState('failed')");
content = content.replace(/isConnecting/g, "connectionState === 'starting' || connectionState === 'authenticating' || connectionState === 'processing'");
content = content.replace(/setStep\('CONNECTED'\)/g, "setConnectionState('connected')");
content = content.replace(/step === 'CONNECTED'/g, "connectionState === 'connected'");

fs.writeFileSync('components/BankConnectionWidget.tsx', content);
console.log('Patched BankConnectionWidget.tsx');
