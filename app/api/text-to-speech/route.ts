import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_COACH_VOICE } from '@/lib/services/ai/ConversationOrchestrator';

export async function POST(req: NextRequest) {
    try {
        const { text, voice = DEFAULT_COACH_VOICE, speed = 1.05 } = await req.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Valid text parameter is required' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
        if (!apiKey) {
            console.error('[TTS API Error]: OpenAI API key missing');
            return NextResponse.json({ error: 'OpenAI API key missing' }, { status: 500 });
        }

        const numericSpeed = typeof speed === 'number' && !isNaN(speed) ? speed : 1.05;
        const clampedSpeed = Math.max(0.5, Math.min(numericSpeed, 2.0));
        const truncatedText = text.slice(0, 4096);
        const selectedVoice = ['nova', 'alloy', 'shimmer', 'echo', 'fable', 'onyx'].includes(voice) ? voice : DEFAULT_COACH_VOICE;

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                voice: selectedVoice,
                input: truncatedText,
                speed: clampedSpeed,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[TTS API Error]:', errorText);
            return NextResponse.json({ error: 'TTS conversion failed' }, { status: response.status });
        }

        const audioBuffer = await response.arrayBuffer();

        return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error: any) {
        console.error('[TTS Error]:', error?.message || error);
        return NextResponse.json({ error: 'Failed to synthesize speech' }, { status: 500 });
    }
}
