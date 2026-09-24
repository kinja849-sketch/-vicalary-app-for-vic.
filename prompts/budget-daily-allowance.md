# Budget Daily Allowance Fix

## Understanding the Problem
The user reported that the `Daily Allowance` is not reflecting accurately and needs to be calculated strictly based on the personalized monthly cycle (which starts on the exact day of the month the user signed up). 

Currently, `lib/financial/BudgetEngine.ts` calculates the cycle boundaries correctly (e.g. from August 13 to September 13), correctly determining that there are 14 days left in the cycle. 

However, the `recommendedDailySpend` (Daily Allowance) is hardcoded as:
`monthlyBudget / 30`

This calculation is flawed for two reasons:
1. It assumes every month has exactly 30 days, rather than using the actual length of the user's personalized monthly cycle (which could be 28, 30, or 31 days).
2. It is a static baseline that does not adapt. If a user spends Rp0 for the first 17 days of their cycle, their remaining Daily Allowance for the last 14 days should dynamically increase to let them spend their remaining budget (`remainingBudget / daysRemaining`).

## Proposed Implementation

I will modify `lib/financial/BudgetEngine.ts`.

1. **Change the calculation of `recommendedDailySpend` (Daily Allowance) to be dynamic:**
   Instead of hardcoding `monthlyBudget / 30`, we will calculate it based on what is left in the cycle.
   ```typescript
   // Calculate remaining budget
   const remainingBudget = Math.max(0, monthlyBudget - spentThisMonth);

   // Calculate simple days remaining in cycle
   const daysRemaining = Math.max(1, Math.ceil((endOfCycle.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

   // Calculate the true Daily Allowance dynamically based on the personalized cycle
   const isWeekly = onboarding?.weekly_budget != null;
   const recommendedDailySpend = isWeekly 
       ? Number(onboarding.weekly_budget) / 7 
       : (remainingBudget / daysRemaining);
   ```

2. **Verify impact on `remainingToday`:**
   `remainingToday` is currently calculated as `Math.max(0, recommendedDailySpend - spentToday)`.
   If we change `recommendedDailySpend` to reflect the *actual* remaining allowance per day, `remainingToday` will correctly display how much of today's updated dynamic allowance is left.

3. **Status Logic:**
   The status logic `spentToday > recommendedDailySpend` will naturally adapt. If they save money early in the month, they are permitted a higher daily allowance later without triggering a budget warning.

## Validation
Once applied, for a user with a Rp212 total budget, Rp0 spent so far, and 14 days left in their cycle, their new Daily Allowance will accurately reflect `Rp15` instead of being hardcoded to `Rp7`.
