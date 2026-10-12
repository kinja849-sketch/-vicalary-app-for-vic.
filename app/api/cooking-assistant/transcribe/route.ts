import { NextRequest, NextResponse } from 'next/server';
import { getBackupApiKey, isOpenAIAvailable, tripOpenAICircuit } from '@/lib/ai/ai-fallback';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob;
        
        if (!file) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        const primaryKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
        const backupKey = getBackupApiKey();

        // 1. Try Primary Provider (OpenAI Whisper) if circuit is closed
        if (primaryKey && isOpenAIAvailable()) {
            try {
                const openAiFormData = new FormData();
                openAiFormData.append('file', file, 'audio.webm');
                openAiFormData.append('model', 'whisper-1');

                const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${primaryKey}`,
                    },
                    body: openAiFormData,
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data?.text) {
                        return NextResponse.json({ text: data.text });
                    }
                } else {
                    const errorText = await response.text();
                    console.warn('[Whisper API Error]:', response.status, errorText);
                    if (response.status === 429 || response.status === 402 || errorText.includes('insufficient_quota') || errorText.includes('billing')) {
                        tripOpenAICircuit();
                    }
                }
            } catch (openAiErr) {
                console.warn('[Whisper API Exception]:', openAiErr);
            }
        }

        // 2. Fallback: Google Gemini multimodal transcription
        if (backupKey) {
            try {
                const arrayBuf = await file.arrayBuffer();
                const base64Audio = Buffer.from(arrayBuf).toString('base64');
                const rawMime = file.type || 'audio/webm';
                const mimeType = rawMime.split(';')[0].trim() || 'audio/webm';

                console.info('[Cooking-Assistant-Transcribe] Using Gemini audio transcription fallback with MIME:', mimeType);
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${backupKey}`;
                
                const geminiRes = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { inlineData: { mimeType, data: base64Audio } },
                                { text: 'Transcribe this spoken kitchen query or cooking command strictly. Return only the exact spoken words with punctuation. Do not add commentary or notes.' }
                            ]
                        }]
                    })
                });

                if (geminiRes.ok) {
                    const geminiData = await geminiRes.json();
                    const transcribedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                    if (transcribedText) {
                        return NextResponse.json({ text: transcribedText });
                    }
                } else {
                    const errText = await geminiRes.text();
                    console.warn('[Gemini Transcribe Error]:', geminiRes.status, errText);
                }
            } catch (geminiErr) {
                console.warn('[Gemini Transcribe Exception]:', geminiErr);
            }
        }

        return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
    } catch (error: any) {
        console.error('[Cooking-Assistant-Transcribe Error]:', error?.message);
        return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
    }
}
