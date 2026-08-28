import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Temporary mock to prevent 404s until the real coach logic is fully wired up
  return NextResponse.json({
    success: true,
  });
}
