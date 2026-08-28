const fs = require('fs');
const file = 'components/BankConnectionWidget.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/fetch\(\\/api\/banking\/user-banks\, {/g, 'fetch(/api/banking/user-banks, {\n                    credentials: "include",');
code = code.replace(/fetch\(\\/api\/banking\/institutions\?country=\\$\{countryCode\}\, {/g, 'fetch(/api/banking/institutions?country=\\$\{countryCode\}, {\n                    credentials: "include",');
code = code.replace(/fetch\('\/api\/bank\/link-token', {/g, 'fetch(\'/api/bank/link-token\', {\n                    credentials: "include",');
code = code.replace(/fetch\('\/api\/bank\/exchange-token', {/g, 'fetch(\'/api/bank/exchange-token\', {\n                    credentials: "include",');
code = code.replace(/fetch\(endpoint, {/g, 'fetch(endpoint, {\n                    credentials: "include",');

fs.writeFileSync(file, code);
