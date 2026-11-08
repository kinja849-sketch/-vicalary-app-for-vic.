import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { getAICompletionJson } from '@/lib/ai/ai-fallback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  ur: 'Urdu',
  bn: 'Bengali',
  hi: 'Hindi',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  ru: 'Russian',
  id: 'Indonesian',
  sw: 'Swahili',
  mr: 'Marathi',
  te: 'Telugu',
  ta: 'Tamil',
  vi: 'Vietnamese',
  so: 'Somali',
  my: 'Burmese',
  ko: 'Korean',
  tr: 'Turkish',
  de: 'German',
};

// Fast check for strings with only emojis, punctuation, numbers, or whitespace
const NON_TRANSLATABLE_REGEX = /^[\p{Emoji}\p{Number}\p{Punctuation}\p{Symbol}\s]+$/u;
const URL_ONLY_REGEX = /^https?:\/\/[^\s]+$/i;

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawText = typeof body.text === 'string' ? body.text.trim() : '';
    const targetLang = typeof body.targetLang === 'string' && body.targetLang.trim() ? body.targetLang.trim().toLowerCase() : 'en';

    if (!rawText) {
      return NextResponse.json({ error: 'Missing or empty text parameter' }, { status: 400 });
    }

    // Limit translation request size to 3000 chars for chat safety
    const textToTranslate = rawText.slice(0, 3000);

    // Fast-path bypass for non-translatable text (pure emojis, numbers, links)
    if (NON_TRANSLATABLE_REGEX.test(textToTranslate) || URL_ONLY_REGEX.test(textToTranslate)) {
      return NextResponse.json({
        translatedText: textToTranslate,
        detectedSourceLang: 'Original',
        targetLang,
        isSameLanguage: true,
      });
    }

    const targetName = LANGUAGE_NAMES[targetLang] || targetLang.toUpperCase();

    const systemPrompt = `You are an accurate, high-fidelity real-time chat translator for private 1-on-1 human conversations.
Your objective is to translate the user's message accurately into ${targetName} (${targetLang}) with ZERO distortion.

STRICT ZERO-DISTORTION RULES:
1. Maintain the exact meaning, conversational tone (casual, slang, abbreviations, formality), nuance, and brevity of the original message.
2. DO NOT elaborate, summarize, explain, add pleasantries, or answer the message. You are solely translating it.
3. DO NOT alter or "correct" informal typos or casual phrasing into stiff textbook language — mirror the conversational register directly in ${targetName} (e.g. short informal greetings like "hy" translate to the target language equivalent casual greeting).
4. DO NOT translate personal names, proper nouns, usernames, brand names, or URLs.
5. PRESERVE ALL emojis, symbols, numbers, punctuation, and line breaks in their exact relative positions.
6. If the message is already written in ${targetName}, return the exact original text.
7. Return ONLY valid JSON in this schema:
{
  "translatedText": "<translated message>",
  "detectedSourceLang": "<Full English name of source language, e.g. English, French, Spanish, Indonesian, Arabic>"
}`;

    const completion = await getAICompletionJson<{
      translatedText?: string;
      detectedSourceLang?: string;
    }>({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: textToTranslate },
      ],
      temperature: 0.0,
      max_tokens: 1500,
    });

    const translatedText = completion?.translatedText?.trim() || textToTranslate;
    const detectedSourceLang = completion?.detectedSourceLang?.trim() || 'Detected';

    return NextResponse.json({
      translatedText,
      detectedSourceLang,
      targetLang,
      isSameLanguage: detectedSourceLang.toLowerCase() === targetName.toLowerCase(),
    });
  } catch (error: any) {
    console.error('[Chat Translation Route Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Translation failed' },
      { status: 500 }
    );
  }
}
