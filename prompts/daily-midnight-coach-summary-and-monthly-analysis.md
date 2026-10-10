# Implementation Prompt: Daily Midnight Health Coach Summary, Weekly Milestone Inputs, and Tailored Monthly AI Analysis

## 1. Executive Summary & Objective
Implement a robust, timezone-aware reflection and analysis loop for every user from the moment they join:
1. **Weekly Milestone & Daily Check-in Inputs**: Preserve join-date-based 7-day milestones in [CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx) while keeping the highlighted "today" cell as the primary interactive gateway to log daily progress (weight, mood, reflections) via [ManualProgressInput.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ManualProgressInput.tsx) and milestone days via [MilestoneModal.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/MilestoneModal.tsx). Guarantee reliable date boundary calculations in the user's local timezone (preventing UTC date shift bugs).
2. **Daily Health Coach Summary at Local Midnight**: Implement a scheduled background job and secure API route ([app/api/daily-summary/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-summary/route.ts) & [app/api/cron/daily-summary/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cron/daily-summary/route.ts)) that detects users whose local time has crossed 00:00 midnight. Synthesizes a grounded activity evidence pack (calories/macros vs goals, meals logged, scans, weight/mood/reflections, budget events, coach engagement) for the completed day, writes a 3–5 sentence coaching message in the user's language, and posts it into the user's authentic AI Health Coach conversation with strict idempotency (never duplicate for the same user and date). For zero-activity days, posts an empathetic, non-shaming encouragement message.
3. **Tailored End-of-Month AI Analysis**: Assemble a comprehensive evidence pack across the entire month in [app/api/monthly-analysis/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/monthly-analysis/route.ts) including daily progress rows, progress measurements (weight trajectory, mood), weekly milestones (objectives, plan suggestions, problems faced), food history and scans, and budget metrics. Generate a personalized report and persist to `monthly_reports`, faithfully rendered by [app/_pages/ProgressAnalysis.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ProgressAnalysis.tsx).

---

## 2. Source of Truth & Architecture Mapping

| Feature Component | Source of Truth | Storage / Persistence | Read / Display Surface |
| :--- | :--- | :--- | :--- |
| **Join Date** | `user_profiles.created_at` or Supabase `auth.users.created_at` | `user_profiles` / `auth.users` | [CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx) |
| **User Timezone & Language** | `user_settings.timezone`, `user_settings.language` (fallback to IP geo / detected) | `user_settings` | Server cron, AI prompts, Calendar |
| **Daily Progress & Measurements** | `progress_measurements` (weight, mood, reflection) & `daily_progress` (macros, calories, goals) | PostgreSQL `progress_measurements`, `daily_progress` | [ManualProgressInput.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ManualProgressInput.tsx), Dashboard |
| **Weekly Milestones** | `user_milestones` (objective, plan_suggestion, problems_faced) | PostgreSQL `user_milestones` (unique on `user_id, milestone_date`) | [MilestoneModal.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/MilestoneModal.tsx) |
| **Daily Coach Summary** | Real activity evidence pack on local completed date | `messages` in AI coach conversation (`metadata: { type: 'daily_summary', date: 'YYYY-MM-DD' }`) | AI Health Coach Chat ([ChatConversation.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx)) |
| **Monthly Analysis** | Longitudinal monthly evidence pack | `monthly_reports` (unique on `user_id, report_year, report_month`) | [ProgressAnalysis.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ProgressAnalysis.tsx) |

---

## 3. Detailed Component Plan & Changes

### A. Calendar & User Input Fixes
1. **Fix Timezone Date Splitting in Inputs**:
   - In [ManualProgressInput.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ManualProgressInput.tsx) and [lib/api/progress.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/progress.ts), replace `date.toISOString().split('T')[0]` with local formatted date `format(date, 'yyyy-MM-dd')` to prevent off-by-one date shifts across timezones.
2. **CheckpointCalendar Interaction & Milestone Logic**:
   - In [CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx), ensure `today` is computed cleanly and aligns with user timezone.
   - Milestone days occur every 7 days from `normalizeDate(joinDate)`.
   - On clicking a day:
     - If it's a milestone day, open [MilestoneModal.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/MilestoneModal.tsx).
     - If it's the highlighted `today` cell (even if it coincides with a milestone), ensure the user can trigger daily check-in via [ManualProgressInput.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ManualProgressInput.tsx) while still having access to the milestone form.

### B. Daily Summary at Local Midnight
1. **Secure Cron Endpoint & Netlify Scheduler**:
   - Add [app/api/cron/daily-summary/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cron/daily-summary/route.ts):
     - Authenticate via `CRON_SECRET` header (`Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`).
     - Query all active users and their `user_settings` (`timezone`, `language`).
     - Filter users whose local time is currently in the midnight hour (`00:00` - `00:59`).
     - Calculate completed local date `yesterday` (format `YYYY-MM-DD`).
     - Invoke daily summary generation with idempotency checks.
   - Add Netlify scheduled function in [netlify/functions/daily-summary-cron.mts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/netlify/functions/daily-summary-cron.mts) and configure schedule in [netlify.toml](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/netlify.toml).
2. **Rich Activity Evidence Assembly in [app/api/daily-summary/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-summary/route.ts)**:
   - Accept `{ userId, targetDate, force }` (allowing manual/test calls and cron batch calls).
   - Fetch:
     - `daily_progress` for `targetDate`.
     - `progress_measurements` for `targetDate` (weight, mood, reflections).
     - `food_analysis_history` + `food_items` within that local day's timestamp range.
     - `budget_transactions` within that local day.
     - User messages in the AI Coach conversation for that day.
     - `user_profiles` and `onboarding_responses` (goals, calorie targets).
     - User language preference from `user_settings`.
3. **Idempotency & Per-User Coach Conversation Lookup**:
   - Resolve the exact AI Coach conversation for `userId`:
     Query `conversation_participants` where `user_id = userId` and `conversations.conversation_type = 'ai'`. If not found, provision it automatically using service-role Supabase client.
   - Check if a message with `metadata->type = 'daily_summary'` and `metadata->date = targetDate` already exists in this conversation. If found and not `force: true`, return `{ alreadySent: true }`.
4. **Tone, Language & Zero-Activity Handling**:
   - Use `callChatCompletionWithFallback` with strict prompt:
     - If activities exist: 3–4 sentences, praise progress, offer supportive tip, grounded in real numbers.
     - If zero activity: compassionate, gentle check-in prompt (no shame, encouraging habit consistency).
     - Response must be strictly written in the user's language (`user_settings.language`).
   - Store message with `sender_id = COACH_ID ('00000000-0000-0000-0000-000000000001')`, `message_type = 'system'`, update `conversations.last_message_at` and `conversations.last_message_content`.

### C. Tailored Monthly Analysis at Month End
1. **Comprehensive Month-End Evidence Assembly in [app/api/monthly-analysis/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/monthly-analysis/route.ts)**:
   - Calculate exact calendar month bounds (`startDate = YYYY-MM-01`, `endDate = YYYY-MM-lastDay`).
   - Query:
     - All `daily_progress` rows in the month (calories, macros, meals logged).
     - All `progress_measurements` in the month (weights, mood logs, reflection texts).
     - All `user_milestones` in the month (objectives, plans, challenges faced).
     - All `food_analysis_history` in the month (analyses, scanner items, meal ratings).
     - All `budget_transactions` in the month (total spend on food).
     - User goals and profile settings.
2. **AI Prompt & Structured JSON Synthesis**:
   - Synthesize:
     - `summary`: Deep analytical reflection citing the user's specific progress and weekly notes.
     - `insights`: Array of 3 key takeaways (nutrition trend, behavioral pattern from milestone challenges, financial efficiency).
     - `adherencePercentage`: Number calculated from actual daily adherence.
     - `spendingEfficiency`: "EXCELLENT" | "GOOD" | "POOR".
     - `tips` / `actionPlan`: Concrete next-month actionable steps.
     - `motivationalMessage`: Personalized empowering quote/message.
     - `trend`: "improving" | "maintaining" | "struggling".
   - Language mandate: strictly in the user's language.
3. **Storage & UI Alignment**:
   - Upsert report into `monthly_reports` with correct column names (`user_id, report_year, report_month, summary, insights, adherence_percentage, spending_efficiency, tips, trend`).
   - Return formatted object matching [ProgressAnalysis.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ProgressAnalysis.tsx) expectation (`actionPlan`, `motivationalMessage`, `summary`, `insights`).
   - In [app/_pages/ProgressAnalysis.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ProgressAnalysis.tsx), seamlessly render the retrieved analysis and milestone journey.

---

## 4. Acceptance Criteria
1. **Weekly Milestone & Daily Check-in**:
   - From join date, weekly milestones (every 7 days) are identifiable and open [MilestoneModal.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/MilestoneModal.tsx).
   - The today cell opens daily check-in ([ManualProgressInput.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ManualProgressInput.tsx)).
   - Both forms save with local date format `YYYY-MM-DD` and are persisted to `daily_progress`, `progress_measurements`, and `user_milestones`.
2. **Daily Health Coach Summary**:
   - At local 00:00 midnight for any user timezone, exactly one daily summary message is generated for the prior completed day.
   - Message lands in the user's authentic AI Health Coach conversation with coach sender ID.
   - Grounded in real metrics (calories, macros, scans, mood, budget) or a gentle prompt if no activity.
   - Summary is written in user's language.
   - Re-running cron never produces duplicate messages for the same user and date.
3. **Monthly Tailored Analysis**:
   - Gathers full month evidence pack including milestone notes, measurements, food analyses, and budget.
   - Generates non-generic, grounded analysis in the user's language.
   - Persists to `monthly_reports` and renders cleanly on the Analysis screen.
4. **Security & Performance**:
   - Cron endpoint is protected with `CRON_SECRET`.
   - No regressions to normal chat, voice agent, meal logging, or budget features.

---

## 5. Verification & Testing Steps
1. **Weekly & Daily Input Test**:
   - Open Dashboard, tap "Today" on CheckpointCalendar, enter weight `70.5`, mood `Energetic`, reflection `Hit my protein goal!`, save.
   - Tap a milestone day (e.g. Day 7), enter objective `maintain`, plan `focus on fiber`, problems `busy afternoon`, save.
   - Inspect database rows in `progress_measurements`, `daily_progress`, and `user_milestones` to verify correct date and fields.
2. **Forced Daily Summary Test**:
   - Send `POST /api/daily-summary` with `{ "userId": "<test_user_id>", "targetDate": "2026-10-10", "force": true }`.
   - Verify 200 response with generated summary text.
   - Verify coach message appears in the user's Health Coach chat (`/chat/<coach_conv_id>`).
   - Call again without `force: true` and verify `{ alreadySent: true }` and no duplicate message inserted.
3. **Forced Monthly Analysis Test**:
   - Send `POST /api/monthly-analysis` with `{ "userId": "<test_user_id>", "year": 2026, "month": 10 }`.
   - Verify 200 response with tailored summary, insights referencing milestone notes, adherence percentage, and action plan.
   - Navigate to `/analysis` and verify the report is displayed with zero errors.
