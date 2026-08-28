import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { BudgetEngine } from '@/lib/financial/BudgetEngine';

export async function GET(request: Request) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const summary = await BudgetEngine.calculateBudgetStatus(user.id);
        
        if (!summary) {
             return NextResponse.json({ success: true, needs_setup: true, summary: null });
        }

        return NextResponse.json({ success: true, summary });

    } catch (err: any) {
        console.error("Budget engine daily route error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
