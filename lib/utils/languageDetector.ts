/**
 * Precision Language Detector for 1-on-1 Chat Messages
 * 
 * Determines whether an incoming message is written in a foreign language
 * relative to the viewing user's active language and universal comprehension.
 */

// Universal words and abbreviations commonly understood across modern chat apps
const UNIVERSAL_WORDS = new Set([
  'hi', 'hy', 'hey', 'heyy', 'heyyy', 'hello', 'hlo', 'holla', 'yo', 'sup', 'wassup', 'wazzup',
  'ok', 'okay', 'k', 'kk', 'yes', 'yep', 'yeah', 'yea', 'yup', 'no', 'nah', 'nope',
  'thx', 'thanks', 'thank', 'ty', 'tysm', 'pls', 'please', 'sry', 'sorry',
  'cool', 'nice', 'great', 'fine', 'good', 'well', 'awesome', 'super', 'perfect',
  'lol', 'lmao', 'rofl', 'haha', 'hahaha', 'hahahaha', 'hehe', 'hehehe', 'xd',
  'wkwk', 'wkwkwk', 'huhu', 'huhuhu',
  'bye', 'cya', 'gn', 'gm', 'tc', 'brb', 'btw', 'idk', 'omg', 'wtf', 'afk',
  'bro', 'sis', 'dude', 'man', 'babe', 'dear', 'friend', 'buddy',
  'love', 'you', 'u', 'me', 'call', 'see', 'ready', 'wait', 'done', 'link', 'pin',
  // Common Indo-English loanwords / universal mobile words
  'ya', 'iya', 'oke', 'okey', 'siap', 'sip', 'mantap', 'halo', 'hei'
]);

// Non-Latin Script Regexes
const SCRIPTS: Record<string, { regex: RegExp; langs: string[] }> = {
  arabic: {
    regex: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/,
    langs: ['ar', 'ur']
  },
  burmese: {
    regex: /[\u1000-\u109F\uA9E0-\uA9FF]/,
    langs: ['my']
  },
  cjk: {
    regex: /[\u4E00-\u9FFF\u3400-\u4DBF]/,
    langs: ['zh']
  },
  japanese: {
    regex: /[\u3040-\u309F\u30A0-\u30FF]/,
    langs: ['ja']
  },
  korean: {
    regex: /[\uAC00-\uD7AF\u1100-\u11FF]/,
    langs: ['ko']
  },
  cyrillic: {
    regex: /[\u0400-\u04FF]/,
    langs: ['ru']
  },
  devanagari: {
    regex: /[\u0900-\u097F]/,
    langs: ['hi', 'mr']
  },
  bengali: {
    regex: /[\u0980-\u09FF]/,
    langs: ['bn']
  },
  tamil: {
    regex: /[\u0B80-\u0BFF]/,
    langs: ['ta']
  },
  telugu: {
    regex: /[\u0C00-\u0C7F]/,
    langs: ['te']
  }
};

// Distinct signature vocabulary for Latin-script languages
const LATIN_VOCAB: Record<string, string[]> = {
  es: [
    'hola', 'buenos', 'días', 'tardes', 'noches', 'cómo', 'estas', 'estás', 'gracias', 'amigo',
    'por', 'favor', 'qué', 'pero', 'dónde', 'cuándo', 'mucho', 'bien', 'mañana', 'tarde',
    'tengo', 'quiero', 'nosotros', 'ellos', 'estoy', 'también', 'nada', 'siempre', 'ahora'
  ],
  fr: [
    'bonjour', 'bonsoir', 'salut', 'comment', 'allez', 'vous', 'merci', 'beaucoup', 'oui',
    'non', 'avec', 'pour', 'dans', 'sur', 'être', 'avoir', 'suis', 'fait', 'très', 'bien',
    'demain', 'aujourd', 'hui', 'mon', 'ami', 'votre', 'notre'
  ],
  de: [
    'guten', 'morgen', 'abend', 'hallo', 'wie', 'geht', 'danke', 'bitte', 'nicht', 'und',
    'ich', 'bist', 'sind', 'war', 'haben', 'sehr', 'gut', 'vielleicht', 'tschüss', 'wiedersehen',
    'auch', 'heute', 'alles', 'klar'
  ],
  id: [
    'selamat', 'pagi', 'siang', 'malam', 'apa', 'kabar', 'terima', 'kasih', 'makasih', 'kamu',
    'saya', 'dia', 'mereka', 'kita', 'bisa', 'tidak', 'gak', 'nggak', 'mau', 'sudah', 'udah',
    'lagi', 'ada', 'disini', 'dimana', 'gimana', 'kenapa', 'dong', 'sih', 'yuk', 'sekarang',
    'besok', 'kapan', 'jangan', 'banget', 'bener'
  ],
  pt: [
    'olá', 'bom', 'dia', 'boa', 'tarde', 'noite', 'tudo', 'bem', 'obrigado', 'obrigada',
    'você', 'como', 'vai', 'muito', 'até', 'amanhã', 'mais', 'também', 'estou', 'aqui'
  ],
  vi: [
    'xin', 'chào', 'cảm', 'ơn', 'khỏe', 'không', 'thế', 'nào', 'hẹn', 'gặp', 'lại', 'bạn',
    'tôi', 'rất', 'vui', 'được', 'hôm', 'nay'
  ],
  en: [
    'the', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'what', 'when', 'where', 'which',
    'who', 'why', 'how', 'this', 'that', 'these', 'those', 'with', 'from', 'about', 'would',
    'could', 'should', 'there', 'their', 'they', 'we', 'you', 'your', 'my', 'mine', 'our',
    'because', 'always', 'never', 'sometimes', 'today', 'tomorrow', 'yesterday'
  ]
};

/**
 * Checks whether an incoming message in a 1-on-1 chat is in a foreign language.
 * 
 * @param text The message content string
 * @param userLang The viewing user's active language code (e.g. 'en', 'id', 'es', etc.)
 * @param isMe Whether the message was sent by the viewing user themselves
 * @returns boolean True if foreign (show "See translation"), False if understandable (hide)
 */
export function isForeignMessage(
  text: string | null | undefined,
  userLang: string = 'en',
  isMe: boolean = false
): boolean {
  // Rule 1: A user's own sent messages are never foreign to themselves
  if (isMe) return false;

  // Rule 2: Empty, non-string, or very short inputs
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;

  // Rule 3: Links / URLs are universal
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return false;

  // Rule 4: Extract meaningful words (strip punctuation, emojis, numbers)
  const words = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  // If no alphabetical words remain (e.g. only numbers, symbols, emojis), it's universal
  if (words.length === 0) return false;

  // Rule 5: Universal chat vocabulary check
  // If ALL words in the message are in the universal set, it is universally understandable (e.g. "hy", "hello", "ok thanks", "haha cool")
  const allUniversal = words.every(w => UNIVERSAL_WORDS.has(w));
  if (allUniversal) return false;

  const normalizedUserLang = userLang.toLowerCase().slice(0, 2);

  // Rule 6: Check for Non-Latin scripts
  for (const scriptKey of Object.keys(SCRIPTS)) {
    const { regex, langs } = SCRIPTS[scriptKey];
    if (regex.test(trimmed)) {
      // If the text contains this script, it is foreign unless the user's language uses this script
      const userUsesScript = langs.includes(normalizedUserLang);
      return !userUsesScript;
    }
  }

  // Rule 7: Latin-script languages differentiation
  // Count matches against vocabulary of user's language vs foreign languages
  const userVocab = new Set(LATIN_VOCAB[normalizedUserLang] || (normalizedUserLang === 'en' ? LATIN_VOCAB.en : []));

  let userLangScore = 0;
  let foreignScores: Record<string, number> = {};

  for (const word of words) {
    if (UNIVERSAL_WORDS.has(word)) {
      // Universal words count towards understanding
      userLangScore += 1;
      continue;
    }

    if (userVocab.has(word)) {
      userLangScore += 2;
    }

    for (const [langCode, vocabList] of Object.entries(LATIN_VOCAB)) {
      if (langCode === normalizedUserLang) continue;
      if (vocabList.includes(word)) {
        foreignScores[langCode] = (foreignScores[langCode] || 0) + 2;
      }
    }
  }

  // Find the highest foreign language match score
  let maxForeignScore = 0;
  for (const score of Object.values(foreignScores)) {
    if (score > maxForeignScore) maxForeignScore = score;
  }

  // If foreign indicators outweigh user language understanding with confidence:
  if (maxForeignScore >= 2 && maxForeignScore > userLangScore) {
    return true;
  }

  // Inverted punctuation marks in Spanish (¿ or ¡)
  if ((trimmed.includes('¿') || trimmed.includes('¡')) && normalizedUserLang !== 'es') {
    return true;
  }

  // Specific accents unique to French, German, Vietnamese, etc.
  if (/[àâçéèêëîïôûùüÿœæ]/i.test(trimmed) && normalizedUserLang !== 'fr' && normalizedUserLang !== 'de' && normalizedUserLang !== 'es') {
    return true;
  }
  if (/[äöüß]/i.test(trimmed) && normalizedUserLang !== 'de') {
    return true;
  }
  if (/[ươăâđêôơ]/i.test(trimmed) && normalizedUserLang !== 'vi') {
    return true;
  }

  // If user is English and message contains typical multi-word foreign phrases
  if (normalizedUserLang === 'en') {
    if (userLangScore === 0 && maxForeignScore >= 2) {
      return true;
    }
    // By default, if an English user receives a message without clear foreign markers, it's considered understandable
    return false;
  }

  // If user is non-English (e.g. Indonesian) and message contains English-specific vocabulary
  if (normalizedUserLang !== 'en') {
    const enScore = foreignScores['en'] || 0;
    if (enScore >= 2 && enScore > userLangScore) {
      return true;
    }
  }

  return false;
}
