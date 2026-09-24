# Budget Currency Conversion Fix

See implementation_plan.md artifact for full details.

## Root Causes
1. BudgetEngine auto-creates user_budget_profiles with unconverted USD values
2. Once persisted, subsequent loads skip conversion
3. No metadata to distinguish legacy USD from localized values
4. Scanner expenses hardcode currency: IDR
5. Frontend formats values using independently-detected currency
