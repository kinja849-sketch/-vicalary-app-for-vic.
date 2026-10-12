import { NextRequest, NextResponse } from 'next/server';
import { synthesizeVoiceAudioWithFallback } from '@/lib/ai/ai-fallback';
import { DEFAULT_COACH_VOICE } from '@/lib/services/ai/ConversationOrchestrator';

export async function POST(req: NextRequest) {
    try {
        const { text, speed = 1.05 } = await req.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Valid text parameter is required' }, { status: 400 });
        }

        // Strictly enforce the single unified human coach voice across the entire application
        const voiceResult = await synthesizeVoiceAudioWithFallback(text, { 
            voice: DEFAULT_COACH_VOICE, 
            speed: Math.max(0.8, Math.min(speed, 1.3)) 
        });

        if (!voiceResult || !voiceResult.buffer) {
            return NextResponse.json({ error: 'Failed to synthesize speech' }, { status: 500 });
        }

        return new NextResponse(new Uint8Array(voiceResult.buffer), {
            status: 200,
            headers: {
                'Content-Type': voiceResult.mimeType || 'audio/mpeg',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error: any) {
        console.error('[TTS Error]:', error?.message);
        return NextResponse.json({ error: 'Failed to synthesize speech' }, { status: 500 });
    }
}
