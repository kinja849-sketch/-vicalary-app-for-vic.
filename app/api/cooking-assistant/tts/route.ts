import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { text, voice = 'nova', speed = 1.0 } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
        }

        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key missing');
        }

        // Use high-definition TTS model with ultra-natural human voice choices (nova, shimmer, alloy)
        const selectedVoice = ['nova', 'shimmer', 'alloy', 'echo', 'fable', 'onyx'].includes(voice) ? voice : 'nova';
        
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1-hd',
                voice: selectedVoice,
                input: text,
                speed: Math.max(0.7, Math.min(speed, 1.25)),
            }),
        });

        if (!response.ok) {
            throw new Error(`TTS API error: ${await response.text()}`);
        }

        // Return the audio stream directly to the client
        const audioBuffer = await response.arrayBuffer();
        
        return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error: any) {
        console.error('[TTS Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
