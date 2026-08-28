import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { bankingRouter } from '@/lib/financial/BankingProviderRouter';
import { RegionService } from '@/lib/financial/RegionService';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    // 1. Authenticate user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Fetch the user's financial region to determine the best provider
    let region = await RegionService.getUserRegion(userId);
    if (!region) {
      // Fallback: detect region from headers (e.g. Vercel x-vercel-ip-country) or use default
      const detected = await RegionService.detectRegion();
      // Temporarily use the detected region if not saved yet
      region = { ...detected, user_id: userId } as any; 
    }

    const countryCode = region!.country_code;

    // 3. Route to the correct banking provider
    const provider = await bankingRouter.getBestProviderForCountry(countryCode);
    if (!provider) {
      return NextResponse.json(
        { error: `No supported banking provider for country: ${countryCode}` }, 
        { status: 400 }
      );
    }

    // 4. Create the secure link connection
    const connectionSession = await provider.createConnection(userId, countryCode);

    // 5. Send ONLY the short-lived link token back to the frontend
    return NextResponse.json({
      linkToken: connectionSession.linkToken,
      provider: connectionSession.provider,
      expiresAt: connectionSession.expiresAt
    });

  } catch (error: any) {
    console.error("[API] Error creating link token:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
