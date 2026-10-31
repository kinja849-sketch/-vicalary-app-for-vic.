# Implementation Prompt: Rectify Hijri Calendar Label Across UI and Localization

## 1. Executive Summary & Objective
The user identified an inaccurate terminology defect in the main home checkpoint view header: the heading currently displays **"Hijri Timeline"** instead of the accurate Islamic terminology **"Hijri Calendar"**. The user has explicitly directed:
> *"I have noticed that instead of saying hijri calendar, you said hijri timeline, so make sure that is fixed. Make sure that is fixed. I don't like how it is."*

The objective of this task is to rectify the display label to **"Hijri Calendar"** in [components/CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx) and comprehensively update the localization dictionaries across all 21 supported languages in [lib/translations/](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/) so that "Timeline" phrasing is replaced with "Calendar", preserving full backward compatibility and zero UI disruptions.

---

## 2. Technical Root Cause & Architecture Analysis
- **Rendering Component**: [components/CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx#L156) renders:
  ```tsx
  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('hijri_timeline')}</h3>
  ```
- **Translation Dictionaries**: In [lib/translations/en.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/en.ts#L76), the key `hijri_timeline` is assigned `"Hijri Timeline"`.
- **Global Localization**: The term was localized into 21 language dictionaries using direct transliterations of "Timeline" (e.g., Arabic `"الجدول الزمني الهجري"`, Indonesian `"Garis Waktu Hijriah"`, Spanish `"Cronología Hijri"`, French `"Chronologie Hijri"`).
- **Desired Resolution**:
  1. Add/update the translation key `hijri_calendar` to accurately represent "Hijri Calendar" in all 21 translation files.
  2. Update `hijri_timeline` values across all 21 translation files to match "Calendar" as well (or alias `hijri_calendar`), ensuring total backward compatibility if any legacy code or cached state accesses `hijri_timeline`.
  3. Update [components/CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx) to consume `t('hijri_calendar') || t('hijri_timeline')`.

---

## 3. Scope of Changes
### Files to be Modified:
1. [the-app-belong-to-vic--main/components/CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx): Update the component header to reference `t('hijri_calendar') || t('hijri_timeline')`.
2. Localization dictionaries in [the-app-belong-to-vic--main/lib/translations/](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/):
   - [en.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/en.ts): `"Hijri Calendar"`
   - [ar.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/ar.ts): `"التقويم الهجري"`
   - [id.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/id.ts): `"Kalender Hijriah"`
   - [es.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/es.ts): `"Calendario Hijri"`
   - [fr.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/fr.ts): `"Calendrier Hijri"`
   - [de.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/de.ts): `"Hidschri-Kalender"`
   - [bn.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/bn.ts): `"হিজরি ক্যালেন্ডার"`
   - [hi.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/hi.ts): `"हिजरी कैलेंडर"`
   - [ko.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/ko.ts): `"이슬람력 달력"`
   - [mr.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/mr.ts): `"हिजरी कॅलेंडर"`
   - [my.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/my.ts): `"ဟီဂျရီ ပြက္ခဒိန်"`
   - [pt.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/pt.ts): `"Calendário Islâmico"`
   - [ru.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/ru.ts): `"Календарь Хиджры"`
   - [so.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/so.ts): `"Kalandarka Hijriga"`
   - [sw.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/sw.ts): `"Kalenda ya Hijri"`
   - [ta.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/ta.ts): `"ஹிஜ்ரி காலண்டர்"`
   - [te.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/te.ts): `"హిజ్రీ క్యాలెండర్"`
   - [tr.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/tr.ts): `"Hicri Takvim"`
   - [ur.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/ur.ts): `"ہجری کیلنڈر"`
   - [vi.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/vi.ts): `"Lịch Hijri"`
   - [zh.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/zh.ts): `"伊斯兰历日历"`

---

## 4. Verification and Acceptance Criteria
1. **Visual Parity & Accuracy**:
   - Verify on `http://localhost:3000` using Chrome DevTools (`chrome-devtools-mcp`).
   - The checkpoint section header explicitly reads **"Hijri Calendar"** alongside the active green pulsing dot and the ANALYSIS button.
2. **Localization Integrity**:
   - Changing application languages properly reflects the respective "Hijri Calendar" translated title without falling back to "Timeline".
3. **Zero Regression**:
   - No styling, layout, scroll, or milestone logic in [components/CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx) is affected.
   - Clean Next.js build and zero console warnings/errors.
