# Implementation Prompt: Scanner Strict Gates and Fallback Removal

## 1. Goal
Refactor the scanner pipeline to enforce strict sequence gating and eliminate all fabricated AI/fallback values. The scanner must stop gracefully at any failure point rather than continuing with guessed data.

## 2. Immediate Fixes to Implement
1. **Remove Fallback Macros/Calories**: Any hardcoded fallback like 150 kcal, 3g protein, etc., will be removed from the UI and state. If nutrition is missing, it stays 
ull.
2. **Remove AI-Estimated Prices**: Prices must come from the PriceProvider (or cache). AI estimates will not be parsed or sent to the budget engine.
3. **Mandatory Barcode Decoding**: The camera must decode a raw barcode string before any API is called.
4. **Mandatory Product Identity**: The OpenFoodFactsProvider (or similar) must return a valid product before proceeding to nutrition or boycott screening.
5. **Immediate Boycott Screening**: Move the boycott screening step right after product identification.
6. **Strict Boycott Status**: If the boycott check fails or is unavailable, the status must be UNKNOWN. It will never default to Ethically Clear.
7. **Render Gate**: The UI will only show the normal product details (nutrition, price, budget add) if the product passes the boycott gate (i.e., NOT flagged).
8. **Error Separation**: Differentiate AI safety filter errors from network/API errors.
9. **Source Tracking**: Ensure the ScannerResult object tracks the source for product identity, nutrition, price, and boycott status.
10. **Budget Confirmation Gate**: Nothing is sent to the budget engine until the user explicitly confirms a product that has a valid, non-estimated price.

## 3. Architecture Adjustments
- Add console.log("[SCAN RESULT]", { ... }) diagnostic block at the end of the scanner flow.
- Ensure the ScannerResult interface strictly matches the single-object design proposed.

## 4. Execution Steps
1. Refactor lib/scanner/ScannerDecisionEngine.ts to implement the hard gates (Barcode -> Product -> Boycott -> Nutrition -> Price).
2. Clean up frontend components (e.g., components/Scanner.tsx or similar) to remove fallback UI states and respect the hard gates.
3. Add the diagnostic logger to the frontend scan completion handler.
4. Package changes and submit for CodeRabbit review before push.
