# Supabase Auth & Row Level Security (RLS) Skill

## Authentication
- **Primary Method**: Supabase Phone OTP Authentication (`/api/send-otp` and `/api/verify-otp`).
- Do NOT swap or introduce email/password auth as primary without explicit instruction.
- User sessions are managed via Supabase auth cookies / headers.

## Database & Security (RLS)
- Every table MUST enforce Row Level Security (RLS) policies in PostgreSQL.
- Queries executed from client components MUST use the authenticated Supabase client (`lib/supabase/client.ts`).
- Server route handlers or Edge functions using `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase/server.ts` or `admin.ts`) MUST handle authorization checks explicitly before operating on user data.
- NEVER return `SUPABASE_SERVICE_ROLE_KEY` or service-level tokens in API responses.
- Respect database schema migrations in `supabase/migrations/` and Prisma schemas in `prisma/schema.prisma`.
