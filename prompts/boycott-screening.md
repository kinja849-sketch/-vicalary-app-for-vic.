# Implementation Prompt: Boycott Screening Pipeline

## 1. Goal
Implement a political/boycott screening gate that happens *before* the normal product-details screen is allowed to render. The AI must never infer boycott status; it must rely on a structured boycott/campaign data source. A scanned product will be filtered based on the user's followed boycott campaigns before it progresses to price lookup, nutrition detailing, and budget analysis.

## 2. Database Schema Changes
Create new tables in `prisma/schema.prisma` and generate a Supabase migration to track verified campaigns and relationships.

```prisma
model boycott_campaigns {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name         String
  organization String?
  description  String?
  source_url   String?
  status       String?   @default("active")
  updated_at   DateTime? @default(now()) @db.Timestamptz(6)
  created_at   DateTime? @default(now()) @db.Timestamptz(6)

  campaign_targets           campaign_targets[]
  user_campaign_preferences  user_campaign_preferences[]
}

model campaign_targets {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaign_id  String    @db.Uuid
  company_name String
  target_type  String
  reason       String?
  source_url   String?
  verified_at  DateTime? @default(now()) @db.Timestamptz(6)

  boycott_campaigns boycott_campaigns @relation(fields: [campaign_id], references: [id], onDelete: Cascade)
}

model company_relationships {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  brand_name        String
  parent_company    String
  relationship_type String
  source_url        String?
  verified_at       DateTime? @default(now()) @db.Timestamptz(6)
}

model user_campaign_preferences {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id     String    @db.Uuid
  campaign_id String    @db.Uuid
  created_at  DateTime? @default(now()) @db.Timestamptz(6)

  boycott_campaigns boycott_campaigns @relation(fields: [campaign_id], references: [id], onDelete: Cascade)
  user_profiles     user_profiles     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, campaign_id])
}

model product_boycott_matches {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  product_id   String    @db.Uuid
  campaign_id  String    @db.Uuid
  reason       String?
  source_url   String?
  verified_at  DateTime? @default(now()) @db.Timestamptz(6)
  
  // Relations to products and boycott_campaigns
}
```

## 3. Backend Architecture
Restructure `lib/scanner/` to enforce the new pipeline.

- `lib/scanner/BarcodeDecoder.ts`: Handles the raw barcode scan.
- `lib/scanner/ProductLookupService.ts`: Uses OpenFoodFactsProvider to get basic identity (name, brand, category, ingredients, raw nutrition).
- `lib/scanner/BoycottScreeningService.ts`: Evaluates the brand against `company_relationships` and `campaign_targets` for the user's followed `boycott_campaigns`.
- `lib/scanner/AlternativeProductService.ts`: Finds non-flagged alternative products matching category, size, price range.
- `lib/scanner/ScannerDecisionEngine.ts`: The orchestrator.
  1. Identifies product.
  2. Runs boycott screening.
  3. If flagged -> Return `{ status: "flagged", boycottDetails, alternatives }`.
  4. If approved -> Proceed to PriceResolver, NutritionService, and return `{ status: "approved", product, pricing, nutrition }`.
- `lib/ai/ScannerAdvisor.ts`: Takes verified structured data (from either the flagged response or approved response) and turns it into a clear, natural-language explanation.

## 4. Frontend State Machine
Update the scanner UI (likely `components/Scanner.tsx` or similar) to strictly follow the state transitions:
`idle -> scanning -> identifying -> screening -> (flagged OR approved)`

- If `flagged`: Show the `⚠ PRODUCT FLAGGED` UI with Reason, Relationship, Source, Verified Date, and Alternatives. Block price lookup and budget integration.
- If `approved`: Proceed to normal product rendering (`nutrition + price`), and allow adding to budget.
- Provide a `[Choose Alternative]` flow that restarts the scanner pipeline on the new item.

## 5. Security & Principles
- AI must NOT infer or guess boycott status.
- AI must NOT hallucinate nutrition or prices.
- All relationships and targets come directly from the database tables.

## 6. Execution Steps
1. Push Prisma schema updates and run db push / migrations.
2. Build the `lib/scanner/*` modules.
3. Update Next.js API routes used by the scanner frontend.
4. Update frontend state machine and render appropriate UI for flagged products.
5. Create a CodeRabbit review before any final push.
