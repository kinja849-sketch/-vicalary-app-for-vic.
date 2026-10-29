# Implementation Plan: Fix `POST /rest/v1/user_permissions?on_conflict=user_id 404 (Not Found)` & Guarantee Live Server Database Integrity

## 1. Root Cause Analysis
1. **Missing `public.user_permissions` Table in Live Supabase Database (`PGRST205` / HTTP `404`)**:
   - [`lib/services/PermissionManager.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/PermissionManager.ts) queries (`SELECT * FROM user_permissions WHERE user_id = ...`) and upserts (`UPSERT INTO user_permissions ... ON CONFLICT (user_id)`) to persist camera and microphone permission onboarding state.
   - Although [`scripts/create_user_permissions.sql`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/scripts/create_user_permissions.sql) was drafted previously, it was never applied to the live Supabase database (`ifxrkbitnpbxqnbxkncp.supabase.co`) because `db.ifxrkbitnpbxqnbxkncp.supabase.co` resolves only to an IPv6 `AAAA` address (`2406:da18:...`) rather than the IPv4 Supavisor pooler (`aws-1-ap-southeast-1.pooler.supabase.com`).
   - Out of all 49 `.from(...)` tables referenced across the entire codebase, `user_permissions` was the **only** table missing from the live Supabase PostgREST schema cache (`[PGRST205] Could not find the table 'public.user_permissions' in the schema cache`), causing PostgREST to return `404 (Not Found)` every time `PermissionManager` checked or recorded camera/microphone permissions.
2. **Repeated Redundant Upserts in `PermissionManager.ts`**:
   - In [`lib/services/PermissionManager.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/PermissionManager.ts), `checkPermission()` and `requestPermission()` invoked `markOnboarded()` on every permission check or stream initialization without checking whether that user's `(userId, type)` permission had already been synced to Supabase, firing 3 consecutive `POST /rest/v1/user_permissions?on_conflict=user_id` requests on page load.

---

## 2. Exact Changes
1. **Create & Apply Idempotent Migration** ([`supabase/migrations/20261029_create_user_permissions.sql`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/supabase/migrations/20261029_create_user_permissions.sql)):
   - Create `public.user_permissions` (`user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, `camera_permission_onboarded BOOLEAN DEFAULT FALSE`, `microphone_permission_onboarded BOOLEAN DEFAULT FALSE`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`).
   - Enable Row Level Security (RLS) with `SELECT`, `INSERT`, and `UPDATE` policies for `auth.uid() = user_id` and `service_role`.
   - Grant privileges to `authenticated`, `anon`, and `service_role` and execute `NOTIFY pgrst, 'reload schema';` so PostgREST immediately serves `/rest/v1/user_permissions`.
   - Execute the migration against Supabase via the IPv4 Supavisor pooler (`aws-1-ap-southeast-1.pooler.supabase.com`).
2. **Sync Prisma Schema** ([`prisma/schema.prisma`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/prisma/schema.prisma)):
   - Add `model user_permissions` so Prisma schema matches the live Supabase database.
3. **Deduplicate & Harden `PermissionManager.ts`** ([`lib/services/PermissionManager.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/PermissionManager.ts)):
   - Track per-user synced state in `localStorage` (`vic_permission_${type}_db_synced_${currentUserId}`) and in-memory `syncedUsers: Set<string>` so `markOnboarded` only writes to Supabase once per user/permission type instead of spamming `POST /rest/v1/user_permissions?on_conflict=user_id` on every mount.

---

## 3. Verification Criteria
- All **49 out of 49** `.from(...)` tables across the entire application return `✅ OK` on live Supabase PostgREST `/rest/v1/`.
- `POST /rest/v1/user_permissions?on_conflict=user_id` succeeds with `200`/`201` (zero `404` errors).
- Cleanly kill and restart the Next.js server (`http://localhost:8080`) and verify via Chrome DevTools (`chrome-devtools-mcp`) that console and network logs have zero `user_permissions` 404 errors.
