import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { text, voice = 'nova', speed = 1.0 } = await req.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Valid text parameter is required' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key missing');
        }

        const numericSpeed = typeof speed === 'number' && !isNaN(speed) ? speed : 1.0;
        const clampedSpeed = Math.max(0.5, Math.min(numericSpeed, 2.0));
        const truncatedText = text.slice(0, 4096);

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
                input: truncatedText,
                speed: clampedSpeed,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[TTS API Error]:', errorText);
            throw new Error('TTS conversion failed');
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
        console.error('[TTS Error]:', error?.message);
        return NextResponse.json({ error: 'Failed to synthesize speech' }, { status: 500 });
    }
}
