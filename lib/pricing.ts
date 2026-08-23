export async function calculateEconomicPrice(supabase: any, geoInfo: any, productCategory = 'General') {
    let exchangeRate = 1;
    let userCpi = 50; // default global average
    let refCpi = 35; // ID is 35 (baseline reference)
    let basePrice = 20000; // IDR 20,000
    let refCurrency = 'IDR';
    let refCountryCode = 'ID';

    try {
        // 1. Get Reference Price for Category
        const { data: refRow } = await supabase
            .from('reference_prices')
            .select('*')
            .ilike('category', `%${productCategory}%`)
            .maybeSingle();

        if (refRow) {
            basePrice = refRow.base_price;
            refCurrency = refRow.currency;
            refCountryCode = refRow.country_code;
        } else {
            // Fallback to General
            const { data: genRow } = await supabase.from('reference_prices').select('*').eq('category', 'General').maybeSingle();
            if (genRow) {
                basePrice = genRow.base_price;
                refCurrency = genRow.currency;
                refCountryCode = genRow.country_code;
            }
        }

        // 2. Get User CPI and Reference CPI
        const { data: cpiRows } = await supabase
            .from('food_indexes')
            .select('country_code, cpi_value')
            .in('country_code', [geoInfo.country_code, refCountryCode]);

        const userCpiRow = cpiRows?.find((r: any) => r.country_code === geoInfo.country_code);
        const refCpiRow = cpiRows?.find((r: any) => r.country_code === refCountryCode);
        
        if (userCpiRow) userCpi = userCpiRow.cpi_value;
        if (refCpiRow) refCpi = refCpiRow.cpi_value;

        // 3. Get Exchange Rate
        if (geoInfo.currency_code !== refCurrency) {
            const ratesRes = await fetch(`https://open.er-api.com/v6/latest/${refCurrency}`);
            if (ratesRes.ok) {
                const ratesData = await ratesRes.json();
                if (ratesData?.rates?.[geoInfo.currency_code]) {
                    exchangeRate = ratesData.rates[geoInfo.currency_code];
                }
            }
        }

        // 4. Calculate Economic Index-Adjusted Price
        // Formula: Base Price * (User CPI / Ref CPI) * Exchange Rate
        const cpiRatio = userCpi / refCpi;
        const adjustedBasePrice = basePrice * cpiRatio;
        const finalPrice = (adjustedBasePrice * exchangeRate).toFixed(0); // Round to nearest whole number for typical local currencies
        
        // Format with separators
        const formattedFinal = Number(finalPrice).toLocaleString('en-US');
        
        return `${geoInfo.currency_symbol}${formattedFinal}`;

    } catch(e) {
        console.error("Economic Pricing Engine Error:", e);
        return `${geoInfo.currency_symbol}0.00`; // Fallback
    }
}
