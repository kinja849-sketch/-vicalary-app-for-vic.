# Implementation Prompt: Camera/Scanner Labels, IP-Based Default Language with User Preference Persistence, and One-Time Persistent Media Permissions

## 1. Executive Summary & Root Cause Analysis

### A. Button Labels: "Camera" and "Scanner"
- **Current Behavior**:
  - The home dashboard quick action buttons render `t('camera')` and `t('scanner')`.
  - In `lib/translations/en.ts`, `camera` is `"Meal Camera"`.
  - In `lib/translations/id.ts`, `camera` is `"Kamera Makanan"` (Food Camera) and `scanner` is `"Pemindai Kode Batang"` (Barcode Scanner).
  - When the app loaded in Indonesian, Google Chrome's built-in translation translated "Kamera Makanan" to "FOOD CAMERA" and "Pemindai Kode Batang" to "BARCODE SCANNER".
- **Target Behavior**:
  - The buttons must say **"Camera"** and **"Scanner"** (rendered in uppercase as `CAMERA` and `SCANNER`).
  - Translations in `en.ts` must be `camera: "Camera"`, `scanner: "Scanner"`.
  - Translations in `id.ts` must be `camera: "Kamera"`, `scanner: "Pemindai"`.
  - Other translation files will be updated to concise "Camera" and "Scanner" terms without prefixing "Meal" / "Food" / "Barcode".

---

### B. IP Location Default Language & Persistent User Language Selection
- **Current Behavior**:
  - `lib/api/location.ts` detects IP location. When the user's IP is in Indonesia, `detectedLoc.languages` is `['id', 'en']`, so `getPrimaryLanguage` returns `'id'`.
  - In `lib/api/translation.ts`, `isAuto` was treated as true whenever `settings?.is_language_auto !== false`. On initial load, guest sessions, or before settings finish loading from Supabase, `rawLang` prioritizes `getPrimaryLanguage(detectedLoc?.languages)` over cached user selection.
  - A `useEffect` sync hook ran and continuously synced `language: 'id'` into `user_settings` and `localStorage.setItem('app_lang', 'id')`.
  - `document.documentElement.lang` remained hardcoded as `"en"` in `app/layout.tsx` while content was Indonesian, which triggered Chrome's automatic translation bar and mangled calendar day names ("SEL" -> "CELL", "KAM" -> "CAME", "JUM" -> "DAY", "SAB" -> "SIDE").
  - `lib/financial/RegionService.ts` had a hardcoded `defaultRegion` fallback to `ID` / `Indonesia` / `id-ID`.
- **Target Behavior**:
  1. **IP Detection as Default**: The location API (`detectLocation`) determines the country of the user's IP. The primary language of that country becomes the *default language* for first-time visitors / unconfigured users. If location cannot be determined, fallback to English (`'en'`).
  2. **User Selection Override & Persistence**:
     - When a user explicitly selects a language (in Settings Language modal or Profile), we store this in `localStorage.setItem('has_user_selected_lang', 'true')` and `localStorage.setItem('app_lang', selectedLang)`, and update Supabase `user_settings: { language: selectedLang, is_language_auto: false }`.
     - Whenever `has_user_selected_lang` is true or `settings.is_language_auto === false`, the user's selected language MUST be applied across the entire application and CANNOT be overwritten by the IP location API.
     - Only if the user explicitly chooses "Auto Detect" in Settings will `has_user_selected_lang` be cleared (`is_language_auto: true`) to revert back to IP-based detection.
  3. **Sync HTML Document Lang**:
     - Whenever the active language changes, update `document.documentElement.lang = lang` dynamically so browser translation engines do not falsely detect mismatched page languages.

---

### C. Permissions: Request Once & Never Render Again
- **Current Behavior**:
  - In `components/AICoachVoiceModal.tsx`:
    - `hasMicPermission` is a local React state initialized to `null`.
    - On every modal open, `checkPermission` executes `navigator.permissions.query({ name: 'microphone' })`.
    - In Chrome and mobile browsers where permission state is `'prompt'` or where query throws, it immediately sets `hasMicPermission(false)`.
    - When `hasMicPermission === false`, lines 780-804 render the "Enable Microphone" permission card (`<motion.div> ... <button>Allow Microphone & Start</button></motion.div>`).
    - When the user clicks "Allow Microphone & Start", `requestMicPermission` calls `getUserMedia`, stops the track, and sets `setHasMicPermission(true)`. However, it **never** records in `localStorage` that permission was granted.
    - As soon as the modal closes and reopens, `hasMicPermission` resets to `null`, `checkPermission` sets it to `false`, and the permission card is rendered again!
  - In `lib/api/permissions.ts`:
    - `localStorage.setItem('has_granted_camera', 'true')` and `localStorage.setItem('has_granted_mic', 'true')` are written upon `getUserMedia` success, but `checkPermission` and `AICoachVoiceModal` **never read** these keys!
    - When `navigator.permissions.query` returns `'prompt'`, `checkPermission` overwrites `localStorage.setItem('permission_${name}', 'prompt')`, erasing any record of prior user approval.
- **Target Behavior**:
  1. **Microphone (AICoachVoiceModal & Audio)**:
     - Check `localStorage.getItem('has_granted_mic') === 'true'` or `permission_microphone === 'granted'`.
     - If already granted, initialize `hasMicPermission` to `true` immediately. The "Enable Microphone" card will **never** be rendered.
     - In `checkPermission()`, if `has_granted_mic` is `'true'`, do not flip `hasMicPermission` to `false` when status is `'prompt'` or if the query throws.
     - When the user approves microphone access for the first time via "Allow Microphone & Start", persist `localStorage.setItem('has_granted_mic', 'true')` and `localStorage.setItem('permission_microphone', 'granted')`.
     - Once granted, the permission UI is never rendered again.
  2. **Camera (Dashboard, Camera, QRScanner, CameraCapture)**:
     - In `lib/api/permissions.ts`, `checkPermission('camera')` checks `localStorage.getItem('has_granted_camera') === 'true'`. If true and not explicitly `'denied'`, return `'granted'`.
     - Once granted, the browser/app will not prompt or trigger permission blocked alerts.

---

## 2. Files and Services Involved
1. `lib/translations/en.ts` & `lib/translations/id.ts` (and other translation dictionaries as needed):
   - Update `camera` to `"Camera"` / `"Kamera"`.
   - Update `scanner` to `"Scanner"` / `"Pemindai"`.
2. `lib/api/translation.ts`:
   - Prioritize user-selected language (`has_user_selected_lang` / `is_language_auto === false`) across the application.
   - Use IP-detected country language as the initial default when no user selection exists.
   - Ensure `document.documentElement.lang` is kept in sync with the active language.
3. `app/_pages/Settings.tsx`:
   - Setting a language sets `has_user_selected_lang: 'true'`, `app_lang: selectedCode`, and `is_language_auto: false`.
   - Selecting "Auto Detect" removes `has_user_selected_lang` and sets `is_language_auto: true`.
4. `lib/financial/RegionService.ts`:
   - Remove hardcoded Indonesian default region fallback.
5. `components/AICoachVoiceModal.tsx`:
   - Check `has_granted_mic` on mount. If true, initialize `hasMicPermission = true` and do not render the permission prompt.
   - Persist `has_granted_mic = 'true'` when permission is granted.
6. `lib/api/permissions.ts`:
   - Respect `has_granted_camera` and `has_granted_mic` in `checkPermission`.

---

## 3. Data Flow & Source of Truth

```
[Initial Visitor] -> IP Geolocation API (detectLocation)
                   -> Country's Primary Language (Default Language)
                   -> Saved to localStorage as default
                   -> Rendered across all pages

[User Selection]  -> User clicks Language in Settings
                   -> localStorage.setItem('has_user_selected_lang', 'true')
                   -> localStorage.setItem('app_lang', chosenLang)
                   -> Supabase user_settings { language: chosenLang, is_language_auto: false }
                   -> LOCKED: IP Location will NOT override user selection

[Audio/Camera]    -> User allows access once
                   -> localStorage.setItem('has_granted_mic', 'true') / localStorage.setItem('has_granted_camera', 'true')
                   -> Future opens read grant flag directly
                   -> Permission UI never rendered again
```

---

## 4. Acceptance Criteria & Verification Plan
1. **Labels**:
   - Home screen displays "CAMERA" and "SCANNER" under the respective icons.
   - Translations in English display "CAMERA" and "SCANNER".
   - Translations in Indonesian display "KAMERA" and "PEMINDAI".
2. **Language & Location**:
   - Default language comes from the Location API (IP-based).
   - Once a user switches language to English (or any other language) in Settings, it persists on reload and across all pages; it does not revert to Indonesian.
   - `<html lang="...">` updates dynamically to prevent Chrome from misinterpreting the page language.
3. **Permissions**:
   - Open AI Coach Voice modal: If microphone was previously granted, the voice blob starts immediately without showing the "Enable Microphone" card.
   - If granted for the first time, clicking "Allow Microphone & Start" stores the grant flag; closing and reopening the modal never shows the permission card again.
   - Camera access in Dashboard, Camera page, and QRScanner works seamlessly without repeated permission prompts.
4. **Build & Typecheck**:
   - `npm run typecheck` passes with 0 errors.
   - Real-time dev server runs without errors.
   - Chrome DevTools verification on localhost:3000.
