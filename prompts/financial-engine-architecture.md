# VicCalary Financial Intelligence Architecture

This document defines the complete architectural roadmap and implementation blueprint for integrating the banking system, product scanner, and daily budget engine into a single unified financial ledger.

## 1. Goal
Refactor and combine all isolated financial features (Plaid banking, barcode scanning, manual expenses) into one cohesive, reconcilable financial system. AI will be transitioned to an advisory role, acting on authoritative transaction data rather than inventing it.

## 2. Core Architecture
- **Country Detection First**: Implement a country detection layer (IP + User Confirmation) that dictates which financial provider is loaded.
- **Banking Provider Router**: Introduce BankingProviderService interface. Plaid becomes PlaidProvider alongside future regional implementations.
- **Unified Transaction Ledger**: Introduce inancial_transactions table to merge Bank, Barcode Scan, and Manual expenses.
- **Double-Counting Protection**: Implement TransactionReconciliationService to merge scanned purchases with matching bank transactions.
- **Server-Side Security**: All access tokens (Plaid or otherwise) must stay strictly on the backend.
- **Authoritative Product/Price Lookups**: Barcode scans will route through an actual product database and a separate price provider, eliminating AI-hallucinated prices.

## 3. Database Schema Updates (Prisma/Supabase)
Required new tables (or modifications):
- user_financial_regions (countryCode, currencyCode)
- user_bank_accounts (canonical bank data, balances)
- ank_connections (secure token storage)
- inancial_transactions (The unified ledger with source: bank/manual/scan, and econciliation_status)
- product_price_cache (Authoritative price data for barcodes)

## 4. Implementation Sequence

### Phase 1: Foundation (Country & Provider Router)
1. Build lib/financial/RegionService.ts for detection and confirmation.
2. Build the BankingProvider interface and implement PlaidProvider.ts.
3. Update prisma/schema.prisma with the new tables and generate migrations.

### Phase 2: Bank Integration & Ledger
1. Rewrite Plaid integration to strictly route through the backend (/api/bank/link-token, /api/bank/exchange-token).
2. Sync bank transactions directly into inancial_transactions.

### Phase 3: Barcode & Reconciliation
1. Replace AI barcode scanner logic with an authoritative product/price API lookup.
2. Build TransactionReconciliationService to match newly scanned expenses against incoming bank transactions.

### Phase 4: Budget Engine & AI Advisory
1. Calculate daily/weekly remaining budgets directly from inancial_transactions.
2. Restrict AI access to a read-only summary for generating financial insights, not modifying data.

## 5. Execution Rules
- No client-side exposure of banking tokens.
- Do not maintain static lists of banks; always pull from the active provider.
- AI must NOT invent transactions or guess prices.

