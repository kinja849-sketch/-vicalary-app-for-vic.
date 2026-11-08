import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export function extractAuthToken(req?: Request | NextRequest): string | undefined {
  const authHeader = req?.headers.get('authorization');
  if (authHeader) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  // Fallback: check cookies if req has cookies
  if (req && 'cookies' in req) {
    const nextReq = req as NextRequest;
    const cookieToken = nextReq.cookies.get('sb-access-token')?.value;
    if (cookieToken) return cookieToken;

    const allCookies = nextReq.cookies.getAll?.() || [];
    const authCookie = allCookies.find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));
    if (authCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(authCookie.value));
        return Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
      } catch {
        return authCookie.value;
      }
    }
  }

  return undefined;
}

export function createServerSupabaseClient(req?: Request | NextRequest) {
  const token = extractAuthToken(req);

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    },
  );
}

export async function getAuthenticatedUser(req?: Request | NextRequest) {
  const token = extractAuthToken(req);
  const supabase = createServerSupabaseClient(req);
  const { data: { user }, error } = await (token ? supabase.auth.getUser(token) : supabase.auth.getUser());
  if (error || !user) {
    return null;
  }
  return user;
}

export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

