# Scanner Barcode Resolution, Authentic Pricing, Budget Redirection, and UI Visibility Implementation Plan

## Objective
Fix all issues reported by the user on the Scanner feature:
1. **Barcode Scanning & Product Lookup Trigger**: Ensure that upon scan, the barcode triggers product identification and correctly reads product info (handling normalized EAN-13/UPC-A barcode variants, search fallback, secondary catalog lookup, and image-based product recognition fallback so products are never stuck on "Product Not Found").
2. **Authentic, Accurate Local Pricing**: Obtain authentic, accurate price data for the specific product being bought based on the user's geographic location and local currency (e.g., IDR `Rp` for Indonesia, USD `$` for US). No vague or inaccurate numbers.
3. **Capture Button Label**: Change the capture button label on scanner view from "PHOTO PACKAGE / MEDICATION" to a clean "Capture" button.
4. **Gallery Upload on Scanner**: Fix gallery upload on scanner mode so uploaded images are scanned for barcodes or processed for product analysis.
5. **Remove Flip Icon**: Remove/hide the flip/switch camera button on the scanner view (front camera / main view only).
6. **Text Visibility & High Contrast**: Fix text visibility & contrast in `ProductDetails.tsx` (description context, recommendation text, nutrition, and price text were invisible/unreadable due to light text on light backgrounds).
7. **Calorie & Nutrition Data**: Ensure calorie & nutrition data is populated even when Open Food Facts lacks detailed nutrient data (using AI/enrichment fallback so "Calorie Data Pending" is resolved).
8. **Log Product -> Budget Button & Redirection**: Rename "Log Product" button to "Budget" (or "Cut from Budget"), record the expense item into the user's financial transactions / budget, and redirect the user directly to `/budget` upon clicking.

---

## Touched Files & Proposed Modifications

### 1. `lib/products/BarcodeService.ts` & `app/api/analyze-product-barcode/route.ts`
- **Barcode Resolution & Fallbacks**:
  - Implement barcode normalization (trying EAN-13, UPC-A, with/without leading zero).
  - Add search fallback to Open Food Facts search API (`/cgi/search.pl`) and secondary catalog services (UPC ItemDB).
  - Implement Vision AI fallback for product identification from image frame when raw barcode isn't in public catalog, ensuring barcode scan always resolves the scanned product.
- **Authentic Local Pricing Engine**:
  - Resolve authentic, accurate market pricing for the product based on user location (country & currency).
  - Query `product_price_cache` and local retailer market reference data for specific product categories in local currency (e.g. IDR for Indonesia, USD for US).

### 2. `app/_pages/Camera.tsx`
- **Capture Button Label**: Change `Photo Package / Medication` button text to `Capture`.
- **Remove Camera Flip Button**: Hide the `<SwitchCamera>` icon button when `isScanner` / `scanMode === "BARCODE"`.
- **Fix Gallery Upload**: Update `handleGalleryUpload` so when `scanMode === "BARCODE"`, it processes the uploaded image through barcode detection or calls the barcode/product scan API.

### 3. `components/ProductDetails.tsx`
- **Text Visibility & High Contrast**: Update card styles and text color classes to high contrast (`bg-[#0b141a]` container, `text-[#f1f5f9]`, readable text colors for description, nutrition, recommendation, and price).
- **Log Product -> Budget Button**: Rename button label from `Log Product` to `Budget`.
- **Redirection to Budget**: Update `handleConfirmLog` to execute budget deduction (`saveFoodAnalysis(user.id, analysisToSave, true)`) and navigate to `/budget` via `router.push('/budget')`.

---

## Verification Plan
1. Test barcode scanning with various barcode formats and verify product identification resolves successfully.
2. Test gallery upload on scanner mode.
3. Verify capture button reads "Capture" and camera flip button is hidden on scanner view.
4. Verify `ProductDetails` text contrast (description, recommendation, calories, price are 100% visible and readable).
5. Verify authentic local price is displayed in user's local currency based on location.
6. Click "Budget" button: verify product is saved, transaction is recorded in `financial_transactions`, and browser redirects to `/budget`.
