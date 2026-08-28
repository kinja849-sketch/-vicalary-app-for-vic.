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
    formatNumber: (amount: number | string, decimals?: number) => string;
    isLoading: boolean;
    exchangeRate: number;
}

const CurrencyContext = createContext<CurrencyContextType>({
    countryCode: 'UNKNOWN',
    currencyCode: 'USD',
    currencySymbol: '$',
    setManualOverride: () => { },
    clearOverride: () => { },
    formatCurrency: (amount) => `$${amount}`,
    formatNumber: (amount) => `${amount}`,
    isLoading: true,
    exchangeRate: 1,
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
    const [countryCode, setCountryCode] = useState('UNKNOWN');
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
                setCountryCode(data.country_code || 'UNKNOWN');
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

    const formatNumber = (amount: number | string, decimals?: number) => {
        const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) : amount;
        if (isNaN(numericAmount)) return "0";

        const hasDecimals = decimals !== undefined ? decimals > 0 : numericAmount % 1 !== 0;
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: hasDecimals ? (decimals ?? 2) : 0,
            maximumFractionDigits: hasDecimals ? (decimals ?? 2) : 0,
        }).format(numericAmount);
    };

    const formatCurrency = (amount: number | string) => {
        const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) : amount;
        if (isNaN(numericAmount)) return `${currencySymbol}0`;

        // Check if currency usually has zero decimals (e.g., IDR, JPY, KRW, VND) or if amount is an integer
        const zeroDecimalCurrencies = ['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'HUF'];
        const isZeroDecimal = zeroDecimalCurrencies.includes(currencyCode);
        const hasDecimals = !isZeroDecimal && numericAmount % 1 !== 0;

        const formattedNumber = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: hasDecimals ? 2 : 0,
            maximumFractionDigits: hasDecimals ? 2 : 0,
        }).format(numericAmount);

        // Prepend or append currency symbol nicely
        return `${currencySymbol}${formattedNumber}`;
    };

    const value = React.useMemo(() => ({
        countryCode,
        currencyCode,
        currencySymbol,
        setManualOverride,
        clearOverride,
        formatCurrency,
        formatNumber,
        isLoading,
        exchangeRate
    }), [countryCode, currencyCode, currencySymbol, isLoading, exchangeRate]);

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
};


