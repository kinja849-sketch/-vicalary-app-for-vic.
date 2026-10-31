# Implementation Prompt: Global Locale-Adaptive Usernames and Native Numeral Systems

## 1. Executive Summary & Objective
The user requested two major global localization enhancements across the VicCalary application:
1. **Username Language Adaptation**: When changing languages (e.g., to Arabic), the user's name must adapt to the target script/language rather than remaining as an English/Latin string inside native greetings.
2. **Native Numeral Systems Across the Application**: Languages that have their own non-Western numeral systems (such as Arabic Eastern numerals `٠-٩`, Urdu `۰-۹`, Bengali `০-৯`, Hindi/Marathi Devanagari `०-९`, and Burmese `၀-၉`) must adapt all displayed numbers (percentages, calories, dates, days, meal counts, timers, budget values) to their native numerical characters.

This blueprint establishes a comprehensive, high-fidelity engineering solution that introduces a dedicated localization formatting utility, deeply integrates with `useTranslation()`, and applies native numerals and script adaptation across the application surfaces without UI regressions or performance overhead.

---

## 2. Technical Root Causes & Architecture Blueprint
- **Username Persistence & Display**:
  - User profiles currently store `full_name` as raw Latin text (e.g. `"Liban Said"`, `"Sultan Najib Abdirahman"`).
  - In [app/_pages/Dashboard.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Dashboard.tsx#L834), the greeting directly concatenates `{t('welcome')}, {profile.full_name}`, causing an incongruous script mismatch in Arabic (`"مرحبا بك مجدداً, Liban Said"` instead of `"مرحبا بك مجدداً، ليبان سعيد"`).
- **Hardcoded Standard Numeral Rendering**:
  - Components render raw JavaScript numbers directly into JSX (e.g., `{percentage}%`, `{caloriesConsumed}`, `{date.getDate()}`, `{meal.calories} cal`).
  - Western Arabic digits (`0-9`) are rendered even in Arabic (`ar`), Urdu (`ur`), Bengali (`bn`), Hindi (`hi`), Marathi (`mr`), and Burmese (`my`), which historically and culturally utilize native numerals.
- **Architectural Solution**:
  1. Create a dedicated module [lib/utils/localeFormatting.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/utils/localeFormatting.ts):
     - `localizeDigits(value: string | number, lang: string): string`: High-performance regular-expression digit replacement mapping Western digits `0-9` to native numeral sets for `ar` (`٠-٩`), `ur` (`۰-۹`), `bn` (`০-৯`), `hi`/`mr` (`०-९`), and `my` (`၀-၉`).
     - `localizeUserName(name: string, lang: string): string`: Deterministic name adapter with a canonical dictionary for common global/Islamic names (e.g., Liban Said -> ليبان سعيد, Sultan -> سلطان, Najib -> نجيب, Abdirahman -> عبد الرحمن, Mohamed -> محمد, etc.), a phonetic Latin-to-script transliteration engine for arbitrary user names into Arabic, Urdu, Devanagari, Bengali, and Cyrillic, plus localized native fallbacks for the generic "User" fallback (`المستخدم`, `صارف`, `उपयोगकर्ता`, etc.).
  2. Enhance [lib/api/translation.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/translation.ts):
     - Wrap the translation lookup function `t(key, ...)` so any translation containing numeric digits automatically runs through `localizeDigits` for the current locale.
     - Expose `localizeDigits`, `localizeNumber`, and `localizeUserName` as standard first-class utilities from `useTranslation()`.
  3. Integrate into Core UI Surfaces:
     - [app/_pages/Dashboard.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Dashboard.tsx): Wrap greeting name with `localizeUserName` and dashboard numbers with `localizeDigits`.
     - [components/ProgressCard.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProgressCard.tsx): Format progress percentage (`٠%`), calories consumed, remaining calories, and calorie target.
     - [components/CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx): Format Hijri date badge, day numbers, month carousel numbers, and banner text.
     - [components/FoodCarousel.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/FoodCarousel.tsx): Format meal counts (`١ / ١٢`), calories, cooking time, and meal session hours.
     - [app/_pages/Profile.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Profile.tsx): Adapt user profile heading name to the active language script.
     - [app/_pages/Budget.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Budget.tsx) & [components/DailySummary.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/DailySummary.tsx): Localize budget totals, allowances, and daily macronutrient gram counts.

---

## 3. Scope of File Modifications
1. **New Module**:
   - [the-app-belong-to-vic--main/lib/utils/localeFormatting.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/utils/localeFormatting.ts)
2. **Translation Engine**:
   - [the-app-belong-to-vic--main/lib/api/translation.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/translation.ts)
3. **Primary UI Surfaces**:
   - [the-app-belong-to-vic--main/app/_pages/Dashboard.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Dashboard.tsx)
   - [the-app-belong-to-vic--main/components/ProgressCard.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProgressCard.tsx)
   - [the-app-belong-to-vic--main/components/CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx)
   - [the-app-belong-to-vic--main/components/FoodCarousel.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/FoodCarousel.tsx)
   - [the-app-belong-to-vic--main/app/_pages/Profile.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Profile.tsx)
   - [the-app-belong-to-vic--main/components/DailySummary.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/DailySummary.tsx)

---

## 4. Verification and Acceptance Criteria
1. **Arabic Adaptation**:
   - Switching to Arabic (`ar`) transforms `"Welcome back, Liban Said"` to `"مرحبا بك مجدداً، ليبان سعيد"`.
   - All digits across the dashboard (progress percent `٠٪`, calories `٢١٥٢`, Hijri year `١٤٤٨`, day numbers `١٧`, `١٨`, `١٩`, `٢٠`, meal count `١ / ١٢`, time `٦:٠٠`) render as Eastern Arabic numerals (`٠, ١, ٢, ٣, ٤, ٥, ٦, ٧, ٨, ٩`).
2. **Other Native Numeral Systems**:
   - Bengali (`bn`): Digits render as Bengali numerals (`০, ১, ২, ৩...`).
   - Hindi / Marathi (`hi`, `mr`): Digits render as Devanagari numerals (`०, १, २, ३...`).
   - Urdu (`ur`): Digits render as Urdu numerals (`۰, ۱, ۲, ۳...`).
   - Burmese (`my`): Digits render as Burmese numerals (`၀, ၁, ၂, ၃...`).
3. **Western Standard Script Preserved**:
   - English (`en`), Indonesian (`id`), Spanish (`es`), French (`fr`), German (`de`), etc., continue rendering standard Western numerals (`0-9`) and natural Latin names without regression.
4. **DevTools & Realtime Verification**:
   - Visual verification via Chrome DevTools on `http://localhost:8080/dashboard`.
   - Zero console errors and clean build.
