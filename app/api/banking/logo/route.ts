import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');
    
    if (!domain) {
        return new NextResponse('Missing domain', { status: 400 });
    }
    
    try {
        // Try UpLead first, it is highly reliable for corporate logos
        const url = `https://logo.uplead.com/${domain}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        
        if (response.ok) {
            const buffer = await response.arrayBuffer();
            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': response.headers.get('content-type') || 'image/png',
                    'Cache-Control': 'public, max-age=604800, immutable'
                }
            });
        }
        
        // Fallback to Google Favicon if UpLead fails (e.g. 404)
        const fbUrl = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;
        const fbRes = await fetch(fbUrl);
        if (fbRes.ok) {
            const fbBuffer = await fbRes.arrayBuffer();
            return new NextResponse(fbBuffer, {
                headers: {
                    'Content-Type': fbRes.headers.get('content-type') || 'image/png',
                    'Cache-Control': 'public, max-age=604800, immutable'
                }
            });
        }
        
        return new NextResponse('Not found', { status: 404 });
    } catch (err) {
        console.error("Logo proxy error:", err);
        return new NextResponse('Failed to fetch logo', { status: 500 });
    }
}
