# Precise Local Pricing Calibration — Implementation Blueprint

## 1. Executive Summary & Root Cause
During barcode scanning, local retail prices were showing exaggerated amounts (e.g. 3x to 4x higher than real shelf prices in Indonesia, Malaysia, India, and emerging markets). 

**Root Causes Identified**:
1. **Omission of Purchasing Power Parity (`config.ppp`) in the calculation**:
   In `BarcodeService.ts`, `rawLocalPrice = baseUsd * config.fx * sizeScale;` was missing the `config.ppp` multiplier. Nominal US grocery shelf prices ($1.20 - $2.50) were multiplied directly by nominal exchange rates (e.g. 16,000 for IDR), resulting in inflated prices (e.g. Rp 19,000 - Rp 25,000 for items that sell on shelves for Rp 4,000 - Rp 7,000).
2. **Missing Single-Unit Packaging Detection**:
   Single-serve convenience snacks and drinks (e.g. 30g chips, 200ml milk, 85g noodles, 330ml soda cans) were scaling up to multi-serving or full-container grocery staples.
3. **Live Search Tier 3 Failing on 401**:
   `SearchApi.io` returned HTTP 401 on the provided test key, causing silent fallthrough to the unadjusted category benchmark.
4. **Cache Persistence of Exaggerated Estimates**:
   Inflated prices were stored in `product_price_cache`, causing repeat scans to serve the inflated values.

---

## 2. Solution Specifications

### 2.1 Active PPP Calibration
Formula:
$$\text{Local Price} = \text{Base Category Unit Price} \times \text{PPP Ratio} \times \text{Exchange Rate} \times \text{Single-Unit Weight Scale}$$

Country PPP calibration factors (relative to US baseline = 1.0):
- `ID` (Indonesia): `ppp: 0.28`, `fx: 16000` (e.g., $1.00 base $\times 0.28 \times 16,000 = \text{Rp } 4,480$)
- `MY` (Malaysia): `ppp: 0.35`, `fx: 4.45` (e.g., $1.00 base $\times 0.35 \times 4.45 = \text{RM } 1.55$)
- `SG` (Singapore): `ppp: 0.90`, `fx: 1.34` (e.g., $1.00 base $\times 0.90 \times 1.34 = \text{S\$ } 1.20$)
- `PH` (Philippines): `ppp: 0.30`, `fx: 58.0` (e.g., $1.00 base $\times 0.30 \times 58 = \text{₱ } 17.40$)
- `TH` (Thailand): `ppp: 0.35`, `fx: 34.0` (e.g., $1.00 base $\times 0.35 \times 34 = \text{฿ } 11.90$)
- `VN` (Vietnam): `ppp: 0.25`, `fx: 25400`
- `IN` (India): `ppp: 0.22`, `fx: 84.0`
- `PK` (Pakistan): `ppp: 0.20`, `fx: 278.0`
- `BD` (Bangladesh): `ppp: 0.22`, `fx: 120.0`
- `SA` (Saudi Arabia): `ppp: 0.70`, `fx: 3.75`
- `AE` (UAE): `ppp: 0.75`, `fx: 3.67`
- `GB` (UK): `ppp: 0.85`, `fx: 0.78`
- `DE` / `FR` / `IT` / `ES` (Eurozone): `ppp: 0.75 - 0.80`, `fx: 0.92`
- `US` (United States): `ppp: 1.00`, `fx: 1.00`

### 2.2 Granular Single-Unit Category Calibration
- Instant noodles / pasta / mie: $0.70 base $\to$ in IDR: **Rp 3,100 – Rp 3,500**
- Mineral water / bottled water: $0.75 base $\to$ in IDR: **Rp 3,500 – Rp 5,000**
- Ready-to-drink tea / coffee: $0.90 base $\to$ in IDR: **Rp 4,000 – Rp 6,000**
- Carbonated soft drink / soda can: $1.00 base $\to$ in IDR: **Rp 5,500 – Rp 7,500**
- Single-serve snack / chips / wafer / biscuit: $1.00 base $\to$ in IDR: **Rp 5,000 – Rp 8,500**
- Dairy single-serve milk (200ml - 250ml): $1.20 base $\to$ in IDR: **Rp 5,500 – Rp 7,500**
- Dairy 1L carton milk: $2.40 base $\to$ in IDR: **Rp 18,000 – Rp 24,000**
- Cereal / oats (500g): $3.00 base $\to$ in IDR: **Rp 28,000 – Rp 38,000**
- Bread loaf: $1.80 base $\to$ in IDR: **Rp 14,000 – Rp 19,000**
- Condiments / sauces: $1.10 base $\to$ in IDR: **Rp 8,000 – Rp 14,000**

### 2.3 Single-Serve vs. Bulk Weight Normalizer
Scale multiplier based on exact net quantity:
- Mini/single snack ($\le 50\text{g}$, $\le 200\text{ml}$): scale = `0.70`
- Standard single consumer item ($50\text{g} - 120\text{g}$, $250\text{ml} - 350\text{ml}$): scale = `1.00`
- Medium pack ($150\text{g} - 300\text{g}$, $400\text{ml} - 600\text{ml}$): scale = `1.35`
- Large / Family pack ($350\text{g} - 600\text{g}$, $750\text{ml} - 1\text{L}$): scale = `2.00`
- Bulk / Multi-serving ($> 600\text{g}$, $> 1\text{L}$): scale = `3.00`

### 2.4 Resilient Multi-Search Extraction
In Tier 3, filter out bundle keywords (`"box"`, `"carton"`, `"pack of"`, `"isi 24"`, `"isi 40"`, `"1 dus"`, `"karton"`) so multi-pack wholesale prices are never mistaken for single-unit retail shelf prices.

### 2.5 Sanitize Exaggerated Cache
When reading from `product_price_cache`, if the cached price is marked as `estimated` and exceeds the realistic category ceiling by $> 2.5\times$, recalculate it using the calibrated PPP engine.

---

## 3. Files to Modify
- [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/products/BarcodeService.ts): Implement active PPP formula, single-unit package scaling, multi-pack filtering, and category price calibration.

## 4. Verification Plan
- Typecheck (`npm run typecheck`).
- Test scans across:
  - Indonesian snacks (Chitato, Teh Botol, Indomie, Ultra Milk, Aqua water) $\to$ must match real Indonesian convenience store prices (Rp 3,000 – Rp 8,500).
  - US items (Coca-Cola, Chobani, Quaker Oats) $\to$ must match real US single-unit supermarket prices ($0.99 – $3.99).
  - Malaysian items $\to$ must match real Malaysian supermarket prices (RM 1.50 – RM 5.00).
