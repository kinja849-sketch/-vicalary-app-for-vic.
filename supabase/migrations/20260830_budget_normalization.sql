-- Budget Normalization: Add conversion metadata columns to user_budget_profiles
-- This supports tracking whether legacy USD onboarding budgets have been converted to local currency

ALTER TABLE user_budget_profiles 
  ADD COLUMN IF NOT EXISTS is_normalized BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3),
  ADD COLUMN IF NOT EXISTS exchange_rate_used DECIMAL(16,6),
  ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(100),
  ADD COLUMN IF NOT EXISTS normalized_at TIMESTAMPTZ;

-- Comment on columns for documentation
COMMENT ON COLUMN user_budget_profiles.is_normalized IS 'Whether this budget has been normalized from legacy USD to local currency';
COMMENT ON COLUMN user_budget_profiles.original_amount IS 'Pre-conversion monthly budget amount (in original_currency)';
COMMENT ON COLUMN user_budget_profiles.original_currency IS 'ISO currency code of the original onboarding budget value';
COMMENT ON COLUMN user_budget_profiles.exchange_rate_used IS 'Exchange rate applied during normalization (USD to target currency)';
COMMENT ON COLUMN user_budget_profiles.exchange_rate_source IS 'API source used for exchange rate (e.g. open.er-api.com)';
COMMENT ON COLUMN user_budget_profiles.normalized_at IS 'Timestamp when the budget was normalized/converted';
