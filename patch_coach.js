const fs = require('fs');

let content = fs.readFileSync('app/api/coach-reply/route.ts', 'utf8');

if (!content.includes('BudgetEngine')) {
    content = content.replace("import { WebResearchService } from '@/lib/services/WebResearchService';", "import { WebResearchService } from '@/lib/services/WebResearchService';\nimport { BudgetEngine } from '@/lib/financial/BudgetEngine';");
    
    const contextInjection = \
    let budgetContext = '';
    try {
        const budgetStatus = await BudgetEngine.calculateBudgetStatus(userId);
        if (budgetStatus) {
            budgetContext = \\\
--- BUDGET STATUS ---
Monthly Budget: \ \
Spent This Month: \
Remaining Budget: \
Target Daily Spend: \
Spent Today: \
Remaining Today: \
Status: \\\\;
        }
    } catch(e) { console.error('Budget context error:', e); }

    const combinedContext = \\\
\
\
\\\;\;

    // Wait, let's just find where it sets systemPrompt.
    content = content.replace("const systemPrompt = You are", \
    let budgetContext = '';
    try {
        const budgetStatus = await BudgetEngine.calculateBudgetStatus(userId);
        if (budgetStatus) {
            budgetContext = \\\\\n--- BUDGET STATUS ---\\nMonthly Budget: \ \\\nSpent This Month: \\\nRemaining Budget: \\\nTarget Daily Spend: \\\nSpent Today: \\\nRemaining Today: \\\nStatus: \\\\;
        }
    } catch(e) { console.error('Budget context error:', e); }

    const systemPrompt = \\\You are\);

    content = content.replace("\\\n\\n--- USER PREFERENCES ---", "\\\n\\\n\\n--- USER PREFERENCES ---");
    
    fs.writeFileSync('app/api/coach-reply/route.ts', content);
    console.log('Patched coach-reply/route.ts');
} else {
    console.log('Already patched');
}
