const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testPricing() {
    let exchangeRate = 1;
    let userCpi = 50; 
    let refCpi = 35; 
    let basePrice = 20000; 
    let refCurrency = 'IDR';
    let refCountryCode = 'ID';
    
    let geoInfo = {
      country_code: 'ID',
      currency_code: 'IDR',
      currency_symbol: 'Rp'
    };
    let productCategory = 'General';

    // 1. Get Reference Price for Category
    const { data: refRow } = await supabase
        .from('reference_prices')
        .select('*')
        .ilike('category', `%${productCategory}%`)
        .maybeSingle();

    console.log("Ref Row:", refRow);

    if (refRow) {
        basePrice = refRow.base_price;
        refCurrency = refRow.currency;
        refCountryCode = refRow.country_code;
    }

    const { data: cpiRows } = await supabase
        .from('food_indexes')
        .select('country_code, cpi_value')
        .in('country_code', [geoInfo.country_code, refCountryCode]);

    console.log("CPI Rows:", cpiRows);

    if (geoInfo.currency_code !== refCurrency) {
        console.log("Fetching exchange rate...");
        const ratesRes = await fetch(`https://open.er-api.com/v6/latest/${refCurrency}`);
        const ratesData = await ratesRes.json();
        exchangeRate = ratesData.rates[geoInfo.currency_code];
    }

    const cpiRatio = userCpi / refCpi;
    const adjustedBasePrice = basePrice * cpiRatio;
    const finalPrice = (adjustedBasePrice * exchangeRate).toFixed(0);
    
    const formattedFinal = Number(finalPrice).toLocaleString('en-US');
    console.log(`Final Price String: ${geoInfo.currency_symbol}${formattedFinal}`);
}
testPricing();
