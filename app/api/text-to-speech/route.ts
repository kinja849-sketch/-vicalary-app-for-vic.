import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_COACH_VOICE } from '@/lib/services/ai/ConversationOrchestrator';
import { synthesizeVoiceAudioWithFallback } from '@/lib/ai/ai-fallback';

export async function POST(req: NextRequest) {
    try {
        const { text, voice = DEFAULT_COACH_VOICE, speed = 1.05 } = await req.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Valid text parameter is required' }, { status: 400 });
        }

        const numericSpeed = typeof speed === 'number' && !isNaN(speed) ? speed : 1.05;
        const clampedSpeed = Math.max(0.5, Math.min(numericSpeed, 2.0));
        const truncatedText = text.slice(0, 4096);
        const selectedVoice = ['nova', 'alloy', 'shimmer', 'echo', 'fable', 'onyx'].includes(voice) ? voice : DEFAULT_COACH_VOICE;

        const result = await synthesizeVoiceAudioWithFallback(truncatedText, {
            voice: selectedVoice,
            speed: clampedSpeed,
        });

        if (!result) {
            console.error('[TTS API Error]: Failed to synthesize speech across all providers');
            return NextResponse.json({ error: 'TTS conversion failed on primary and backup providers' }, { status: 502 });
        }

        return new NextResponse(new Uint8Array(result.buffer), {
            status: 200,
            headers: {
                'Content-Type': result.mimeType,
                'Cache-Control': 'public, max-age=3600',
                'X-Audio-Provider': result.provider,
            },
        });
    } catch (error: any) {
        console.error('[TTS Error]:', error?.message || error);
        return NextResponse.json({ error: 'Failed to synthesize speech' }, { status: 500 });
    }
}

