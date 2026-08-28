import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { bankingRouter } from '@/lib/financial/BankingProviderRouter';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    // 1. Authenticate user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Parse request payload
    const body = await req.json();
    const { publicToken, providerId, metadata } = body;

    if (!publicToken || !providerId) {
      return NextResponse.json({ error: 'Missing publicToken or providerId' }, { status: 400 });
    }

    // 3. Resolve the exact provider used during linking
    const provider = bankingRouter.getProvider(providerId);
    if (!provider) {
      return NextResponse.json({ error: 'Invalid provider configuration' }, { status: 400 });
    }

    // 4. Perform the highly secure token exchange ENTIRELY ON THE BACKEND
    // The provider internally saves the encrypted access token into the DB.
    // The frontend never sees the permanent access token.
    const connectionId = await provider.exchangePublicToken(userId, publicToken, metadata);

    // 5. Run the initial account sync automatically
    // Fire and forget, or await depending on requirement. We'll await to confirm accounts exist.
    try {
      const accounts = await provider.getAccounts(connectionId);
      
      // Save accounts to canonical user_bank_accounts table using the service-role admin client
      // because this is sensitive system logic.
      const { createAdminSupabaseClient } = await import('@/lib/supabase-server');
      const adminClient = createAdminSupabaseClient();

      for (const acc of accounts) {
        await adminClient.from('user_bank_accounts').upsert({
          user_id: userId,
          connection_id: connectionId,
          provider: providerId,
          provider_account_id: acc.accountId,
          account_name: acc.name,
          account_type: acc.type,
          account_subtype: acc.subtype,
          currency_code: acc.currency,
          current_balance: acc.currentBalance,
          available_balance: acc.availableBalance,
          is_active: true,
          last_synced_at: new Date().toISOString()
        }, {
          onConflict: 'provider_account_id'
        });
      }
    } catch (syncError) {
      console.warn("[API] Initial account sync failed (but connection succeeded):", syncError);
      // We don't fail the request if just the sync failed, the connection is established.
    }

    return NextResponse.json({ 
      success: true, 
      connectionId,
      message: 'Bank securely connected and access token stored on backend.'
    });

  } catch (error: any) {
    console.error("[API] Error exchanging public token:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
