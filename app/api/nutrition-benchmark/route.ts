import { NextResponse } from 'next/server';
import { runNutritionalAccuracyBenchmark } from '@/lib/testing/NutritionalAccuracyBenchmark';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const report = await runNutritionalAccuracyBenchmark();
    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Benchmark execution failed',
      },
      { status: 500 }
    );
  }
}

