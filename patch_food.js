const fs = require('fs');

let content = fs.readFileSync('lib/api/food.ts', 'utf8');

const replacement = \
    if (historyError) {
        throw historyError;
    }

    // 3. PHASE 8: Standardized PurchaseEvent (Record Expense)
    // If the scan resulted in a price, we automatically log it as a purchase event
    // so the BudgetEngine can deduct it from the daily allowance.
    const price = Number(analysis.price || analysis.estimated_price || 0);
    if (price > 0) {
        try {
            await supabase.from('financial_transactions').insert({
                user_id: userId,
                transaction_date: new Date().toISOString(),
                amount: price,
                currency: analysis.currency_code || 'USD',
                category: 'Food & Dining',
                description: \Purchase: \\,
                reconciliation_status: 'pending', // Can be merged later if bank transaction appears
                provider: 'scanner',
                provider_category: 'barcode_scan'
            });
            console.log("Recorded scanner expense:", price);
        } catch (txErr) {
            console.error("Failed to record scanner expense:", txErr);
        }
    }

    if (historyError) {
\;

content = content.replace(/if \(historyError\) \{/m, replacement);
fs.writeFileSync('lib/api/food.ts', content);
console.log('Success');
