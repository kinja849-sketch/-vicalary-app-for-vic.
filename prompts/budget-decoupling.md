# Goal Description

Decouple the Vicalary budget system from mandatory bank integrations (Finverse/Plaid) and pivot to a self-contained, authenticated user-driven expense tracking system. The budget will be derived directly from onboarding_responses and real spending will be tracked via a new expenses table driven by product scanning and manual entry. Bank integration will be relegated to an optional future feature.

## Proposed Changes

### Prisma Schema Updates
#### [MODIFY] prisma/schema.prisma
- Add a new expenses model to track individual purchases:
  - id (UUID)
  - user_id (UUID, relation to user_profiles)
  - product_id (UUID, optional)
  - product_name (String)
  - barcode (String, optional)
  - quantity (Int)
  - unit_price (Decimal)
  - total_amount (Decimal)
  - currency (String)
  - category (String, optional)
  - purchased_at (DateTime)
  - source (String: barcode / manual / receipt)
  - created_at (DateTime)

### Budget Initialization Engine
#### [MODIFY] lib/financial/BudgetEngine.ts
- Modify calculateBudgetStatus to calculate actual_spending directly by summing up records from the new expenses table for the current date.
- Ensure the budget is fully created/loaded based on onboarding_responses.

### API Architecture Updates
#### [NEW] app/api/expenses/route.ts
- Create a standard POST/GET route for the expenses table.
#### [NEW] app/api/scanner/confirm-purchase/route.ts
- Create the route that finalizes a scanned product purchase.
#### [NEW] app/api/ai/budget-advice/route.ts
- Create a specialized AI advisory route that returns actionable advice when users exceed their limits.

### Frontend Updates
#### [MODIFY] app/_pages/Budget.tsx
- Remove the mandatory BankConnectionWidget blocking state. 
- Add UI states for: Normal, Warning, Almost Exceeded, and Exceeded.
