const fs = require('fs');
function fix(file) {
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(/\\\/g, '\');
    fs.writeFileSync(file, c);
}
fix('app/api/banking/finverse/callback/route.ts');
fix('app/api/banking/finverse/create-link/route.ts');
fix('lib/financial/providers/FinverseProvider.ts');
