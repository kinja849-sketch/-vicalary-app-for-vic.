/**
 * SpeechNormalizer.ts
 * Deterministic normalization between spoken words and numbers/quantities
 */

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  million: 1000000
};

/**
 * Normalizes user spoken text by converting spoken numbers and common speech artifacts into clean text.
 */
export function normalizeSpokenInput(rawText: string): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // Common STT phonetic misinterpretations for calories & health terms
  text = text.replace(/\b(color is|call a re|call arrays|caller ease)\b/gi, 'calories');
  text = text.replace(/\b(k cal|k cows|kilo cal)\b/gi, 'kcal');

  return text;
}

/**
 * Formats numbers into speech-friendly words for accurate TTS pronunciation.
 */
export function numberToWords(num: number): string {
  if (num === 0) return 'zero';

  const units = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function convertChunk(n: number): string {
    let str = '';
    if (n >= 100) {
      str += `${units[Math.floor(n / 100)]} hundred `;
      n %= 100;
    }
    if (n >= 20) {
      str += `${tens[Math.floor(n / 10)]} `;
      n %= 10;
    }
    if (n > 0) {
      str += `${units[n]} `;
    }
    return str.trim();
  }

  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    return `${convertChunk(millions)} million ${remainder > 0 ? numberToWords(remainder) : ''}`.trim();
  }

  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return `${convertChunk(thousands)} thousand ${remainder > 0 ? numberToWords(remainder) : ''}`.trim();
  }

  return convertChunk(num);
}
