# Internationalization (i18n) & Multi-Language Skill

## Language Scope
VICALARY supports 22 languages:
`en`, `ar`, `bn`, `de`, `es`, `fr`, `hi`, `id`, `ko`, `mr`, `my`, `pt`, `ru`, `so`, `sw`, `ta`, `te`, `tr`, `ur`, `vi`, `zh`.

## Implementation Rules
- Never hardcode raw user-facing text strings directly inside React UI components.
- Use `useTranslation()` hook from `react-i18next`.
- Translation files live in `lib/translations/` or public locale dictionaries.
- Ensure RTL layout support for languages such as `ar` (Arabic) and `ur` (Urdu).
- Preserve existing key structures when adding new strings across all language JSON files.
