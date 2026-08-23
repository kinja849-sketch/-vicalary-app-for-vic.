import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Pass the request along, but intercept and inject Geo data into headers
  const response = NextResponse.next();

  // Extract Vercel/Next.js native geo headers
  const country = request.geo?.country || request.headers.get('x-vercel-ip-country') || 'US';
  const city = request.geo?.city || request.headers.get('x-vercel-ip-city') || 'Unknown';
  const latitude = request.geo?.latitude || request.headers.get('x-vercel-ip-latitude') || '';
  const longitude = request.geo?.longitude || request.headers.get('x-vercel-ip-longitude') || '';
  const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';

  // Inject into headers so backend API routes can read them instantly without relying on the frontend
  response.headers.set('x-user-country', country);
  response.headers.set('x-user-city', city);
  response.headers.set('x-user-lat', latitude);
  response.headers.set('x-user-lon', longitude);
  response.headers.set('x-user-ip', ip);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
