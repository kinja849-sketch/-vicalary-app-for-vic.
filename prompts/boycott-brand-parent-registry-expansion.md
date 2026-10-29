# Implementation Prompt: Parent-First Boycott Resolution & Brand-to-Parent Registry Expansion

## 1. Objective & Architectural Contract
Strictly enforce **parent-first boycott resolution across the full corporate ownership chain** on every barcode scan while expanding the deterministic `company_relationships` and `campaign_targets` registry with the full A–Z and parent-company brand tables.

### Core Rules
1. **Parent-First Ownership Chain Resolution**:
   - On every scan, identify the product (`barcode → name, brand`) via [`BarcodeService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/products/BarcodeService.ts).
   - Resolve the product's brand to its parent company (and multi-hop ownership chain, e.g., `Brand → Division/Subsidiary → Ultimate Parent`) via `company_relationships` and deterministic normalization/alias rules.
   - If `product.brand` is missing or does not match directly (common in Open Food Facts records where the brand only appears in `product_name`), perform a careful boundary-checked brand token match on `product.name` against verified multi-character brands in `company_relationships`, then resolve the parent chain.
   - Screen the resolved parent chain (and direct brand if targeted) against `campaign_targets` for active campaigns / user preferences.
   - If the ultimate parent, an intermediate owner, or the direct brand is a campaign target, return `FLAGGED` immediately with `parentCompany` prominently highlighted in `boycottDetails`.
2. **Every Subsidiary Inherits the Parent Flag**:
   - Any brand linked to a boycotted parent in `company_relationships` automatically flags via its parent link, even if only the parent is listed in `campaign_targets`.
3. **Zero Hallucination & Unverified Guard**:
   - Rows marked `Unverified`, `Multiple unrelated brands; market required`, `Multiple businesses; unverified`, `Multiple brands; unverified`, or `ownership requires verification` in the reference tables must **never** trigger a boycott flag.
   - Preserve regional/licensing caveats (`†` notes) in relationship metadata so regional splits (e.g., `7UP`, `KitKat`, `Crunch`, `Rolo`, `Hostess/Voortman`, `Lipton`) are surfaced transparently in the alert reason without fabricating political claims.
4. **No Regression to Approved Scans**:
   - Non-flagged brands continue through [`ScannerDecisionEngine.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/scanner/ScannerDecisionEngine.ts) and [`app/api/analyze-product-barcode/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-product-barcode/route.ts) to return `APPROVED` with nutrition, safety/allergy evaluation, and localized pricing intact.

---

## 2. Root Cause & Current State Analysis
1. **Missing Database Tables in Supabase (`PGRST205`)**:
   - Although `boycott_campaigns`, `campaign_targets`, `company_relationships`, `user_campaign_preferences`, and `product_boycott_matches` exist in [`prisma/schema.prisma`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/prisma/schema.prisma#L838-L892), they were never migrated into the live Supabase database, causing queries in [`BoycottScreeningService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/scanner/BoycottScreeningService.ts) to return `PGRST205` (`null`) and fall back only to a small 19-row `companies` table.
2. **Screening Order & Normalization Gaps in [`BoycottScreeningService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/scanner/BoycottScreeningService.ts)**:
   - Currently checks `campaign_targets` for direct brand before resolving parent relationships, does not normalize diacritics/punctuation/legal suffixes (`Mondelēz` vs `Mondelez`, `Lay’s` vs `Lay's`, `Nestlé` vs `Nestlé S.A.`, `Coca-Cola` vs `The Coca-Cola Company`), does not split comma-separated Open Food Facts `brands` strings (e.g., `"Ferrero, Nutella"` or `"Mondelez, Oreo"`), and only checks a single hop without walking subsidiary → parent chains.
3. **Missing Brand Fallback in [`ScannerDecisionEngine.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/scanner/ScannerDecisionEngine.ts)**:
   - `ScannerDecisionEngine.processScan` only calls `BoycottScreeningService.screenBrand` when `product.brand` is truthy (`if (product.brand)`). If Open Food Facts omits the `brands` field for an item whose title is `"Oreo Chocolate Sandwich Cookies"` or `"Nutella"`, boycott screening is bypassed entirely.

---

## 3. Source of Truth & Data Flow Map

```
Barcode Scan
  │
  ▼
BarcodeService.processScan(barcode, countryCode, ipAddress, packageImage)
  │  (Authoritative identity from Open Food Facts v2 / UPC fallback)
  ▼
ScannerDecisionEngine.processScan(...)
  │  Calls BoycottScreeningService.screenBrand(product.brand, userId, product.name)
  ▼
BoycottScreeningService.screenBrand(brandName, userId, productName)
  ├─ 1. Load active campaign_ids (user_campaign_preferences -> fallback active boycott_campaigns)
  ├─ 2. Extract candidate brand tokens:
  │     - Split product.brand on commas/semicolons/slashes + normalize
  │     - If brand missing or unresolved, careful token-boundary match on product.name against verified brands
  ├─ 3. PARENT-FIRST RESOLUTION (company_relationships):
  │     - Resolve brand -> parent_company (ignoring relationship_type = 'unverified')
  │     - Walk multi-hop ownership chain up to 3 levels (e.g. Friskies -> Nestlé Purina -> Nestlé S.A.)
  │     - Normalize parent company via canonical parent alias map
  ├─ 4. PARENT CAMPAIGN TARGET MATCH (campaign_targets):
  │     - Check resolved parent chain against campaign_targets (canonical name + aliases)
  │     - If matched -> Return FLAGGED with parentCompany, companyName (scanned brand), reason (+ regional † note if present), sourceUrl, verifiedAt
  ├─ 5. DIRECT BRAND CAMPAIGN TARGET MATCH (campaign_targets):
  │     - Check candidate brand directly against campaign_targets
  │     - Populate parentCompany (if brand is itself a parent or has a known parent) so UI always highlights the parent entity
  └─ 6. FALLBACK COMPANIES TABLE CHECK (companies):
        - Check companies table for documented affiliation if not already matched
```

---

## 4. Planned Changes by File

### A. Idempotent Supabase Migration: [`supabase/migrations/20261029_boycott_parent_first_registry.sql`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/supabase/migrations/20261029_boycott_parent_first_registry.sql)
1. Create tables if not existing (matching [`prisma/schema.prisma`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/prisma/schema.prisma)):
   - `public.boycott_campaigns` (`id`, `name`, `organization`, `description`, `source_url`, `status`, `updated_at`, `created_at`)
   - `public.campaign_targets` (`id`, `campaign_id`, `company_name`, `normalized_name`, `aliases`, `target_type`, `reason`, `source_url`, `verified_at`)
   - `public.company_relationships` (`id`, `brand_name`, `normalized_brand`, `parent_company`, `normalized_parent`, `relationship_type`, `notes`, `source_url`, `verified_at`)
   - `public.user_campaign_preferences` (`id`, `user_id`, `campaign_id`, `created_at`)
   - `public.product_boycott_matches` (`id`, `product_id`, `campaign_id`, `reason`, `source_url`, `verified_at`)
2. Add indexes and unique constraints for idempotent upserts:
   - `UNIQUE (campaign_id, normalized_name)` on `campaign_targets`
   - `UNIQUE (normalized_brand, normalized_parent)` on `company_relationships`
   - Fast lookup indexes on `normalized_brand`, `normalized_parent`, and `normalized_name`.
3. Enable Row Level Security (RLS) with public read policies for `boycott_campaigns`, `campaign_targets`, and `company_relationships`, and user-owned RLS policies for `user_campaign_preferences`.
4. Issue `NOTIFY pgrst, 'reload schema';`.

### B. Canonical Registry Dataset & Seed Script: [`lib/scanner/boycottRegistryData.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/scanner/boycottRegistryData.ts) & [`scripts/seed-boycott-registry.js`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/scripts/seed-boycott-registry.js)
1. **Canonical Parent Targets (`campaign_targets`)**:
   - Seed active campaign (`Global Ethical & Corporate Responsibility Watch`) with canonical parent company targets and aliases:
     - `Nestlé S.A.` (aliases: `Nestlé`, `Nestle`, `Nestlé Purina`, `Cereal Partners Worldwide`, `Froneri`)
     - `PepsiCo` (aliases: `PepsiCo, Inc.`, `Frito-Lay`, `Pioneer Foods`, `Pepsi Lipton`)
     - `The Coca-Cola Company` (aliases: `Coca-Cola`, `The Coca-Cola HBC Group`, `Coca-Cola Europacific Partners`, `Aujan Coca-Cola Beverages Company`)
     - `Mars, Incorporated` (aliases: `Mars`, `Mars (Wrigley)`, `Mars (Kellanova)`, `Mars (Champion Petfoods)`, `Wrigley`, `Kellanova`)
     - `Mondelēz International` (aliases: `Mondelēz`, `Mondelez`, `Mondelez International`)
     - `Unilever PLC` (aliases: `Unilever`, `Hindustan Unilever`)
     - `The Magnum Ice Cream Company` (parent: `Unilever PLC`, also targeted as ice-cream parent group)
     - `Danone S.A.` (aliases: `Danone`, `Al Safi Danone`)
     - `Ferrero Group` (aliases: `Ferrero`, `Wells Enterprises`, `Fox's Burton's Companies`, `WK Kellogg`)
     - `The Hershey Company` (aliases: `Hershey`, `Hershey's`)
     - `Kraft Heinz` (aliases: `The Kraft Heinz Company`, `Kraft`, `Heinz`)
     - `Procter & Gamble` (aliases: `P&G`)
     - `Strauss Group`, `SodaStream`, `Sabra`, `Osem`, `Ahava`, `Teva Pharmaceuticals`, `Starbucks`, `McDonald's`, `JAB Holding Company`, `L'Oréal`
2. **Corporate Ownership Chain Links (`company_relationships`)**:
   - Seed all verified rows from the A–Z tables (`100 Grand` through `Zico`) and the Additional Brands table (`Acqua Panna` through `Zoégas`).
   - Seed intermediate subsidiary → parent links so multi-hop chains always resolve to the ultimate parent:
     - `Nestlé Purina` → `Nestlé S.A.`
     - `Cereal Partners Worldwide` → `Nestlé S.A.`
     - `Froneri` → `Nestlé S.A.`
     - `The Magnum Ice Cream Company` → `Unilever PLC`
     - `Hindustan Unilever` → `Unilever PLC`
     - `Al Safi Danone` → `Danone S.A.`
     - `Wells Enterprises` → `Ferrero Group`
     - `Fox's Burton's Companies` → `Ferrero Group`
     - `Pioneer Foods` → `PepsiCo`
     - `Pepsi Lipton` → `PepsiCo`
     - `Frito-Lay` → `PepsiCo`
     - `The Coca-Cola HBC Group` → `The Coca-Cola Company`
     - `Coca-Cola Europacific Partners` → `The Coca-Cola Company`
     - `Aujan Coca-Cola Beverages Company` → `The Coca-Cola Company`
     - `Wrigley` / `Mars (Wrigley)` → `Mars, Incorporated`
     - `Kellanova` / `Mars (Kellanova)` → `Mars, Incorporated`
     - `Champion Petfoods` / `Mars (Champion Petfoods)` → `Mars, Incorporated`
   - Strictly exclude or mark `relationship_type = 'unverified'` for all `Unverified` and ambiguous multi-owner rows (`18/70`, `Abu Siouf`, `Agrifood Marketing`, `Aquarade`, `Asian Delight`, `Bakers' Choice`, `Baracke`, `Biopet`, `Bluey`, `Bwild`, `Calisur`, `CanineX`, `Chunk`, `Crystal`, `D. Hay Marketing LTD`, `Deadsea Collection LTD`, `Desert Diamond`, `Desert Tamar`, `DFS`, `Diablo Sugar Free Chocolate Cake`, `Doppio Coffee`, `DRIVE ME`, `El Aguila`, `El Monaguillo`, `Erel Dates`, `Extrafino`, `Farmer Naturals Medjoul DattelIn`, `Fatti Per Te`, `Field Day`, `Field Produce LTD`, `Fiesta`, `Fiora Vanti`, `Flashlyte`, `Flower INC`, `Fruita Vitals`, `Frutta e Bacche`, `Globus`, `Hamim Vetaim`, `Hayat`, `Jafaden`, `Jim Patterson Food Group`, `Jordan River`, `Jordan River Dates`, `Kiwi Blue`, `Kurma Royale`, `Kykkos Natural Mineral Water`, `Leon's Fruit Shop`, `Mallo`, `Mani Moto`, `One Coconut Water`, `Treatles`, `Trovet`, `Turkuaz Su`, `Ultimates`, `Ventura`, `Vilas`, `Vital`, `Vitale`, `Viva`, `Xferas`, `Yarden Houmous`, `YumYum`, `Zacin`, etc.) so they **never** auto-flag.

### C. Parent-First Resolution Engine: [`lib/scanner/BoycottScreeningService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/scanner/BoycottScreeningService.ts)
1. **Deterministic Normalization & Canonical Alias Resolution**:
   - `normalizeKey(input: string)`: lowercase, NFD diacritic stripping (`Mondelēz` → `mondelez`, `Nestlé` → `nestle`, `Côte d’Or` → `cote d'or`), normalize curly quotes/apostrophes (`’` → `'`), collapse punctuation/hyphens/whitespace, and produce both exact normalized key and stripped-corporate-suffix key (`The Coca-Cola Company` → `coca cola`, `Nestlé S.A.` → `nestle`, `Mars, Incorporated` → `mars`, `Unilever PLC` → `unilever`, `Danone S.A.` → `danone`, `Ferrero Group` → `ferrero`, `The Hershey Company` → `hershey`).
2. **Parent-First Screening Pipeline (`screenBrand(brandName, userId, productName)`)**:
   - Parse candidate brand strings from `brandName` (splitting comma/semicolon/slash lists from Open Food Facts, e.g. `"Mondelez, Oreo"` → `["Mondelez, Oreo", "Mondelez", "Oreo"]`).
   - If `brandName` is empty or yields no match in `company_relationships` / `campaign_targets`, perform a careful boundary-checked token search on `productName` against verified brands (minimum 3 characters, excluding generic/ambiguous terms).
   - **Step 1 (Parent Chain Resolution)**:
     - Query `company_relationships` (with in-memory registry fallback if DB connection/cache is warming) for matching `normalized_brand`.
     - Ignore any row with `relationship_type === 'unverified'` or `parent_company === 'Unverified'`.
     - Follow parent links up to 3 hops (`Brand → Subsidiary → Ultimate Parent`), collecting the ownership chain and any regional `notes`.
   - **Step 2 (Screen Resolved Parent Chain against `campaign_targets`)**:
     - Match the ultimate parent and any intermediate parent against `campaign_targets` (by `normalized_name` or `aliases`).
     - If matched, return `FLAGGED` with:
       - `flagged: true`
       - `companyName`: resolved brand name (e.g., `"Oreo"`, `"Snickers"`, `"Aquafina"`, `"Lay's"`, `"Nutella"`, `"Nescafé"`)
       - `parentCompany`: canonical parent company (e.g., `"Mondelēz International"`, `"Mars, Incorporated"`, `"PepsiCo"`, `"Ferrero Group"`, `"Nestlé S.A."`, or `"Nestlé Purina → Nestlé S.A."` when via subsidiary)
       - `relationshipType`: `'parent'`
       - `reason`: `"Parent company (${parentCompany}) is an active campaign target: ${target.reason}${relationshipNotes ? ` [Note: ${relationshipNotes}]` : ''}"`
   - **Step 3 (Screen Direct Brand against `campaign_targets`)**:
     - If no parent relationship existed or was flagged, check if the brand itself is a direct target in `campaign_targets` (e.g., product brand is `"Coca-Cola"`, `"Nestlé"`, `"PepsiCo"`).
     - Set `parentCompany` to the canonical parent company name (`"The Coca-Cola Company"`, `"Nestlé S.A."`, `"PepsiCo"`, etc.) so the UI always highlights the parent company prominently.

### D. Scanner Decision Engine & API / UI Payload Clarity
1. **[`lib/scanner/ScannerDecisionEngine.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/scanner/ScannerDecisionEngine.ts)**:
   - Call `BoycottScreeningService.screenBrand(product.brand || '', userId, product.name)` even when `product.brand` is empty so products whose brand only appears in `product.name` are still screened via careful name-token resolution.
2. **[`app/api/analyze-product-barcode/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-product-barcode/route.ts) & [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProductDetails.tsx)**:
   - Ensure `boycott.parentCompany` is always populated and displayed prominently in the `FLAGGED` alert card (`Parent Company: <parentCompany>`) alongside the scanned brand (`Brand: <companyName>`) and documented reason.
   - Keep the existing `APPROVED` branch, nutrition, safety engine, pricing, and UI layout untouched.

### E. Developer Documentation for Future Registry Additions
- Document in [`prompts/boycott-brand-parent-registry-expansion.md`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/prompts/boycott-brand-parent-registry-expansion.md) and [`scripts/seed-boycott-registry.js`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/scripts/seed-boycott-registry.js) how to add future `brand → parent` rows so all subsidiaries automatically inherit the parent flag.

---

## 5. Verification & Acceptance Criteria
1. **Database & Migration Verification**:
   - Execute migration and seed script against Supabase; verify `boycott_campaigns`, `campaign_targets`, and `company_relationships` are populated and queryable via Supabase client (`0` `PGRST205` errors).
2. **Core Brand → Parent Chain Spot-Checks**:
   - **Mondelēz International**: `Oreo`, `belVita`, `Cadbury Chocolate`, `Milka`, `Ritz`, `Toblerone`, `Chips Ahoy!`, `7Days`, `Halls` → resolves `Mondelēz International` → `FLAGGED` with parent highlighted.
   - **Mars, Incorporated**: `Snickers`, `Twix`, `Maltesers`, `Skittles`, `Orbit`, `Wrigley's`, `Pringles` (`Mars (Kellanova)`), `Acana` (`Mars (Champion Petfoods)`), `Royal Canin`, `Whiskas`, `Pedigree` → resolves `Mars, Incorporated` → `FLAGGED` with parent highlighted.
   - **PepsiCo**: `Aquafina`, `Lay's`, `Doritos`, `Cheetos`, `Gatorade`, `Quaker`, `Tostitos`, `Frito-Lay`, `Bokomo` (`PepsiCo (Pioneer Foods)`), `Walkers` → resolves `PepsiCo` → `FLAGGED` with parent highlighted.
   - **Ferrero Group**: `Nutella`, `Ferrero Rocher`, `Tic Tac`, `Kinder` / `Duplo` / `Hanuta`, `Butterfinger`, `Baby Ruth`, `100 Grand`, `Blue Bunny` (`Ferrero Group (Wells Enterprises)`), `Keebler` → resolves `Ferrero Group` → `FLAGGED` with parent highlighted.
   - **Nestlé S.A.**: `Nescafé`, `KitKat`, `Maggi`, `Milo`, `Nespresso`, `Nesquik`, `Perrier`, `S.Pellegrino`, `Cerelac`, `Aero`, `Friskies` (`Nestlé Purina → Nestlé S.A.`), `Purina`, `Coffee-Mate` → resolves `Nestlé S.A.` → `FLAGGED` with parent highlighted.
   - **The Coca-Cola Company**: `Coca-Cola`, `Sprite`, `Dasani`, `Fanta`, `Minute Maid`, `Powerade`, `Fuze Tea`, `Fairlife`, `Topo Chico`, `Schweppes` / `Appletiser`, `Barbican` (`Aujan Coca-Cola Beverages Company → The Coca-Cola Company`) → resolves `The Coca-Cola Company` → `FLAGGED` with parent highlighted.
   - **Unilever PLC / The Magnum Ice Cream Company**: `Knorr`, `Hellmann's`, `Dove`, `Vaseline`, `Lux`, `Sunsilk`, `Magnum`, `Ben & Jerry's`, `Cornetto`, `Wall's` / `Algida` → resolves `Unilever PLC` / `The Magnum Ice Cream Company` → `FLAGGED` with parent highlighted.
   - **Danone S.A.**: `Activia`, `Actimel`, `Evian`, `Volvic`, `Aqua`, `Silk`, `Alpro` / `Nutricia`, `AlSafi` (`Al Safi Danone → Danone S.A.`) → resolves `Danone S.A.` → `FLAGGED` with parent highlighted.
   - **The Hershey Company**: `Hershey's`, `Reese's`, `Kisses`, `Jolly Rancher`, `Twizzler`, `Almond Joy & Mounds`, `SkinnyPop` / `Dot's Homestyle Pretzels` → resolves `The Hershey Company` → `FLAGGED` with parent highlighted.
   - **Kraft Heinz**: `Heinz`, `Kraft`, `Velveeta`, `Jell-O`, `Oscar Mayer`, `Ore-Ida`, `A.1.`, `ABC Kecap Manis`, `Pudliszki` → resolves `Kraft Heinz` → `FLAGGED` with parent highlighted.
3. **Unverified & Ambiguous Safety Gate**:
   - Scanning or screening an `Unverified` brand (`18/70`, `Abu Siouf`, `Aquarade`, `Bwild`, `Crystal`, `Viva`, `Vital`, `Al Arz Tahini`, `Anita Gelato`, `Barilla`, `Haribo`) returns `flagged: false` (`APPROVED`) and never false-flags.
4. **End-to-End Localhost & Chrome DevTools Verification**:
   - Verify via `http://localhost:3000` and `/api/analyze-product-barcode` that flagged scans display the `FLAGGED` ethical alert with `Parent Company` clearly highlighted, while unflagged scans proceed to `APPROVED` with nutrition and localized price intact.
