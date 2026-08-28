const fs = require('fs');
const file = 'components/BankConnectionWidget.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace state
code = code.replace(
    /const \[connectionState, setConnectionState\] = useState<.*>.*?;/,
    	ype ConnectionState = "idle" | "selecting_bank" | "creating_session" | "connecting" | "exchanging" | "syncing" | "connected" | "error";\n    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
);

// Fix the useEffect that sets state on mount
code = code.replace(
    /if \(connectionId \|\| success\) {[\s\S]*?router\.replace\('\/budget', { scroll: false }\);[\s\S]*?} else if \(errorParam\) {[\s\S]*?router\.replace\('\/budget', { scroll: false }\);[\s\S]*?}/,
    if (connectionId || success) {\n                setConnectionState('syncing');\n                router.replace('/budget', { scroll: false });\n            } else if (errorParam) {\n                setConnectionState('error');\n                router.replace('/budget', { scroll: false });\n            }
);

// Fix the fetchUserBank error states
code = code.replace(
    /setConnectionState\('ready'\);/g,
    setConnectionState('selecting_bank');
);
code = code.replace(
    /setConnectionState\('loading'\);/g,
    setConnectionState('idle');
);
code = code.replace(
    /setConnectionState\('failed'\);/g,
    setConnectionState('error');
);

// Update handleConnect
code = code.replace(
    /setConnectionState\('starting'\);/g,
    setConnectionState('creating_session');
);

// Update isConnecting
code = code.replace(
    /const isConnecting = .*/,
    const isConnecting = connectionState === 'creating_session' || connectionState === 'connecting' || connectionState === 'exchanging' || connectionState === 'syncing';
);

fs.writeFileSync(file, code);
