import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob;
        
        if (!file) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key missing');
        }

        // We must reconstruct a new FormData to send to OpenAI
        const openAiFormData = new FormData();
        openAiFormData.append('file', file, 'audio.webm');
        openAiFormData.append('model', 'whisper-1');

        console.log(`[Cooking-Assistant-Transcribe] Sending audio to Whisper API...`);

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            body: openAiFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Whisper API Error]:', errorText);
            throw new Error('Audio transcription failed');
        }

        const data = await response.json();
        
        if (data.text) {
            return NextResponse.json({ text: data.text });
        } else {
            throw new Error("No transcription returned");
        }

    } catch (error: any) {
        console.error('[Cooking-Assistant-Transcribe Error]:', error?.message);
        return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
    }
}
