import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Missing prompt parameter' }, { status: 400 });
        }

        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key missing');
        }

        console.log(`[Cooking-Assistant-Image] Generating image for prompt: ${prompt}`);

        // Generate the step-by-step cooking image using DALL-E 3
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                n: 1,
                size: '1024x1024'
            }),
        });

        if (!response.ok) {
            throw new Error(`DALL-E API error: ${await response.text()}`);
        }

        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            return NextResponse.json({ url: data.data[0].url });
        } else {
            return NextResponse.json({ url: null });
        }

    } catch (error: any) {
        console.error('[Cooking-Assistant-Image Error]:', error);
        // Return 200 with url: null to gracefully degrade if the API key lacks DALL-E access
        return NextResponse.json({ url: null });
    }
}
