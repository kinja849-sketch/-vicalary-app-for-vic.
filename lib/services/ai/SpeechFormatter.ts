/**
 * Speech Formatter for natural Text-to-Speech pronunciation
 * Converts raw numbers, calories, weights, and units into natural spoken English
 */

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function convertUnderThousand(num: number): string {
  let str = '';
  if (num >= 100) {
    str += `${ONES[Math.floor(num / 100)]} hundred `;
    num %= 100;
    if (num > 0) str += 'and ';
  }
  if (num >= 20) {
    str += `${TENS[Math.floor(num / 10)]} `;
    num %= 10;
  } else if (num >= 10) {
    str += `${TEENS[num - 10]} `;
    num = 0;
  }
  if (num > 0) {
    str += `${ONES[num]} `;
  }
  return str.trim();
}

function numberToWords(num: number): string {
  if (num === 0) return 'zero';
  if (num < 0) return `negative ${numberToWords(Math.abs(num))}`;

  let result = '';
  if (num >= 1000000) {
    result += `${convertUnderThousand(Math.floor(num / 1000000))} million `;
    num %= 1000000;
  }
  if (num >= 1000) {
    result += `${convertUnderThousand(Math.floor(num / 1000))} thousand `;
    num %= 1000;
  }
  if (num > 0) {
    result += convertUnderThousand(num);
  }
  return result.trim();
}

export function formatForSpeech(text: string): string {
  if (!text) return '';

  let spoken = text;

  // 1. Remove markdown artifacts
  spoken = spoken.replace(/[*#_~`>]/g, '');

  // 2. Format calories: e.g. "1,912 kcal" or "1912 calories"
  spoken = spoken.replace(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:kcal|calories|cal)/gi, (_, numStr) => {
    const rawNum = parseInt(numStr.replace(/,/g, ''), 10);
    if (!isNaN(rawNum)) {
      return `${numberToWords(rawNum)} calories`;
    }
    return `${numStr} calories`;
  });

  // 3. Format standalone comma-separated numbers: e.g. "1,912" or "2,500"
  spoken = spoken.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (_, numStr) => {
    const rawNum = parseInt(numStr.replace(/,/g, ''), 10);
    if (!isNaN(rawNum)) {
      return numberToWords(rawNum);
    }
    return numStr;
  });

  // 4. Format units: kg, lbs, g, ml, %
  spoken = spoken.replace(/(\d+)\s*kg\b/gi, '$1 kilograms');
  spoken = spoken.replace(/(\d+)\s*lbs\b/gi, '$1 pounds');
  spoken = spoken.replace(/(\d+)\s*g\b/gi, '$1 grams');
  spoken = spoken.replace(/(\d+)\s*ml\b/gi, '$1 milliliters');
  spoken = spoken.replace(/(\d+)\s*%/g, '$1 percent');

  return spoken.trim();
}
