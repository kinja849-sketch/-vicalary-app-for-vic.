import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { BarcodeService } from '@/lib/products/BarcodeService';
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

    const body = await req.json();
    const { barcode } = body;

    if (!barcode) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
    }

    // 2. Get user region to ensure accurate regional pricing
    const region = await RegionService.getUserRegion(userId);
    const countryCode = region?.country_code || 'US';

    // 3. Process scan through the authoritative provider (NOT AI)
    const result = await BarcodeService.processScan(barcode, countryCode);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[API] Error processing barcode scan:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
