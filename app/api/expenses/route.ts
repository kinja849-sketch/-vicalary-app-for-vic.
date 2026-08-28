import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    // 1. Authenticate user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json();
    const { amount, currency, description, category, source, merchantName } = body;

    if (!amount || !currency || !description || !source) {
      return NextResponse.json({ error: 'Missing required expense fields' }, { status: 400 });
    }

    const adminClient = createAdminSupabaseClient();

    // 2. Insert into the unified financial_transactions ledger
    const { data, error } = await adminClient.from('financial_transactions').insert({
      user_id: userId,
      amount,
      currency,
      description,
      merchant_name: merchantName || null,
      category: category || 'Uncategorized',
      source, // 'manual' or 'barcode_scan'
      transaction_date: new Date().toISOString(),
      is_pending: true, // Manual and Scanned are considered pending until reconciled with bank
      reconciliation_status: 'unmatched'
    }).select('id').single();

    if (error || !data) {
      throw new Error(error?.message || "Database insert failed");
    }

    return NextResponse.json({ success: true, transactionId: data.id });
  } catch (error: any) {
    console.error("[API] Error logging expense:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
