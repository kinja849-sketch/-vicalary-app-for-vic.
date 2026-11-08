# Implementation Blueprint: Fix 401 Unauthorized on Presence Last-Seen Endpoints

## 1. Context & Root Cause Analysis

### Symptoms
The browser console logs repeated `401 (Unauthorized)` errors:
- `POST http://localhost:8080/api/presence/last-seen 401 (Unauthorized)` from `stampLastSeen` in [useLastSeenHeartbeat.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/hooks/useLastSeenHeartbeat.ts)
- `GET http://localhost:8080/api/presence/last-seen?user_id=... 401 (Unauthorized)` from `peerLastSeen` query in [ChatConversation.tsx](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/_pages/ChatConversation.tsx#L797)

### Technical Root Cause
1. **Missing Authorization Header**:
   - In [hooks/useLastSeenHeartbeat.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/hooks/useLastSeenHeartbeat.ts#L8-L12), `stampLastSeen` calls `fetch('/api/presence/last-seen', { method: 'POST', keepalive: true, credentials: 'same-origin' })`. A code comment assumed `"Cookies carry the session"`.
   - In [app/_pages/ChatConversation.tsx](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/_pages/ChatConversation.tsx#L797), `peerLastSeen` calls `fetch('/api/presence/last-seen?user_id=...', { credentials: 'same-origin' })`.
   - Neither of these calls attaches an `Authorization: Bearer <access_token>` header.
2. **Supabase Client vs Backend Server Session Resolution**:
   - The frontend Supabase client ([lib/supabase.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/supabase.ts)) stores the user authentication session in browser `localStorage`. It does not store or send auth JWTs in HTTP cookies by default.
   - The backend route handler ([app/api/presence/last-seen/route.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/presence/last-seen/route.ts)) calls `getAuthenticatedUser(req)` from [lib/supabase-server.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/supabase-server.ts).
   - [lib/supabase-server.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/supabase-server.ts#L5) reads only `req.headers.get('authorization')`. When missing, it returns `null`, causing the route to return `401 Unauthorized`.

---

## 2. Proposed Changes

### File 1: [hooks/useLastSeenHeartbeat.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/hooks/useLastSeenHeartbeat.ts)
- Import `supabase` from `@/lib/supabase`.
- Make `stampLastSeen` async:
  - Retrieve the current session token via `supabase.auth.getSession()`.
  - Guard: If `!token`, bail out silently (avoid sending unauthenticated requests).
  - Call `fetch('/api/presence/last-seen', { method: 'POST', keepalive: true, headers: { Authorization: 'Bearer ' + token } })`.
- Update invocation points (mount, interval, `visibilitychange`, `pagehide`, unmount cleanup) to trigger `void stampLastSeen()`.

### File 2: [app/_pages/ChatConversation.tsx](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/_pages/ChatConversation.tsx)
- In the `peerLastSeen` query function (`queryKey: ['peer-last-seen', resolvedOtherUserId]`):
  - Retrieve session token using `supabase.auth.getSession()`.
  - If `!token`, return `null`.
  - Include `headers: { Authorization: 'Bearer ' + token }` in the `fetch('/api/presence/last-seen?user_id=...')` call.

### File 3: [lib/supabase-server.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/supabase-server.ts)
- Enhance `createServerSupabaseClient` and `getAuthenticatedUser`:
  - Primary token source: `req.headers.get('authorization')`.
  - Fallback token source: Check `req.cookies` (for `sb-access-token` or `sb-<project>-auth-token`) to maintain hybrid compatibility with cookie-based SSR sessions if present.
  - Pass the resolved token directly to `supabase.auth.getUser(token)`.

---

## 3. Data Flow & Source of Truth
- **Source of Truth for User Identity**: Server-verified Supabase session (`authUser.id`).
- **Data Flow**:
  1. Frontend retrieves access token from active Supabase session in `supabase.auth.getSession()`.
  2. Frontend sends `Authorization: Bearer <access_token>` to `/api/presence/last-seen`.
  3. Next.js Route verifies token with Supabase Auth server-side.
  4. Server performs authenticated operations (stamping own `last_seen` in `user_profiles` or fetching peer `last_seen`).

---

## 4. Verification Plan
1. **Static Analysis & Typecheck**:
   - Run `npm run typecheck` to confirm no TypeScript errors.
2. **Dev Server & Realtime Logs**:
   - Verify dev server output and browser console network logs.
3. **Presence Heartbeat Check**:
   - Confirm `POST /api/presence/last-seen` returns `200 OK` (`{ ok: true }`).
   - Confirm `GET /api/presence/last-seen?user_id=...` returns `200 OK` (`{ last_seen: ... }`) without 401 errors.
