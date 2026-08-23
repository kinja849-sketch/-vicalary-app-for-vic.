"use client"
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';

interface CurrencyContextType {
    countryCode: string;
    currencyCode: string;
    currencySymbol: string;
    setManualOverride: (countryCode: string, currencyCode: string, currencySymbol: string) => void;
    clearOverride: () => void;
    formatCurrency: (amount: number | string) => string;
    isLoading: boolean;
    exchangeRate: number;
}

const CurrencyContext = createContext<CurrencyContextType>({
    countryCode: 'US',
    currencyCode: 'USD',
    currencySymbol: '$',
    setManualOverride: () => { },
    clearOverride: () => { },
    formatCurrency: (amount) => `$${amount}`,
    isLoading: true,
    exchangeRate: 1,
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
    const [countryCode, setCountryCode] = useState('US');
    const [currencyCode, setCurrencyCode] = useState('USD');
    const [currencySymbol, setCurrencySymbol] = useState('$');
    const [isLoading, setIsLoading] = useState(true);
    const [exchangeRate, setExchangeRate] = useState(1);

    // Centralized location fetch via detectLocation utility
    const fetchGeoLocation = async () => {
        try {
            const { getUserLocation } = await import('./api/location');
            const data = await getUserLocation();

            if (data) {
                setCountryCode(data.country_code || 'US');
                setCurrencyCode(data.currency || 'USD');
                setCurrencySymbol(data.currency_symbol || '$');
                
                if (data.currency && data.currency !== 'USD') {
                    try {
                        const res = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
                        const rates = await res.json();
                        if (rates.rates[data.currency]) {
                            setExchangeRate(rates.rates[data.currency]);
                        }
                    } catch(e) {}
                }
            }
        } catch (e) {
            console.error('Failed to fetch geo IP', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // 1. Check for manual override in local storage
        const storedOverride = localStorage.getItem('currency_override');
        if (storedOverride) {
            const { country, currency, symbol } = JSON.parse(storedOverride);
            setCountryCode(country);
            setCurrencyCode(currency);
            setCurrencySymbol(symbol);
            setIsLoading(false);
        } else {
            // 2. Fall back to automatic IP detection
            fetchGeoLocation();
        }
    }, []);

    const setManualOverride = (country: string, currency: string, symbol: string) => {
        setCountryCode(country);
        setCurrencyCode(currency);
        setCurrencySymbol(symbol);
        localStorage.setItem('currency_override', JSON.stringify({ country, currency, symbol }));
    };

    const clearOverride = () => {
        localStorage.removeItem('currency_override');
        setIsLoading(true);
        fetchGeoLocation(); // Re-detect based on IP
    };

    const formatCurrency = (amount: number | string) => {
        const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) : amount;
        if (isNaN(numericAmount)) return `${currencySymbol}0.00`;

        return new Intl.NumberFormat(countryCode === 'US' ? 'en-US' : 'en-GB', {
            style: 'currency',
            currency: currencyCode,
            currencyDisplay: 'symbol'
        }).format(numericAmount).replace(currencyCode, currencySymbol).trim();
        // Replaced standard code with explicit symbol if Intl tries to use the 3-letter code
    };

    const value = React.useMemo(() => ({
        countryCode,
        currencyCode,
        currencySymbol,
        setManualOverride,
        clearOverride,
        formatCurrency,
        isLoading,
        exchangeRate
    }), [countryCode, currencyCode, currencySymbol, isLoading, exchangeRate]);

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
};
