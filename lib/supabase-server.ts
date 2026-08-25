import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export function createServerSupabaseClient(req?: Request | NextRequest) {
  const authHeader = req?.headers.get('authorization');
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined;

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
  const supabase = createServerSupabaseClient(req);
  const { data: { user }, error } = await supabase.auth.getUser();
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

