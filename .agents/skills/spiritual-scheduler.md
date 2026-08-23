# Spiritual Content & Prayer-Time Scheduler Skill

## Core Principles
- **Prayer Window Calculations**: Calculate local prayer times based on user coordinates or cached IP location (`ip_location_cache`).
- **Contextual Guidance**: Deliver Quran verses, Hadith quotes, or spiritual reminders tailored to active prayer windows and daily nutrition milestones.

## Rules
- Store user spiritual interactions in `user_spiritual_history` table.
- Cache location IP calculations cleanly to prevent excessive external IP lookup queries.
- Support local toast and browser notifications for prayer reminder windows when enabled in `user_settings`.
