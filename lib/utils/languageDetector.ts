/**
 * Universal Precision Language Detector for 1-on-1 Chat Messages
 * 
 * Determines whether an incoming message is written in a foreign language
 * relative to the viewing user's active language and universal comprehension.
 * 
 * Supports translating from ANY of the world's 100+ languages into the user's active language.
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
  'love', 'call', 'see', 'ready', 'wait', 'done', 'link', 'pin',
  // Common Indo-English loanwords / universal mobile words
  'ya', 'iya', 'oke', 'okey', 'siap', 'sip', 'mantap', 'halo', 'hei'
]);

// Non-Latin Script Regexes
const SCRIPTS: Record<string, { regex: RegExp; langs: string[] }> = {
  arabic: { regex: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/, langs: ['ar', 'ur'] },
  burmese: { regex: /[\u1000-\u109F\uA9E0-\uA9FF]/, langs: ['my'] },
  cjk: { regex: /[\u4E00-\u9FFF\u3400-\u4DBF]/, langs: ['zh'] },
  japanese: { regex: /[\u3040-\u309F\u30A0-\u30FF]/, langs: ['ja'] },
  korean: { regex: /[\uAC00-\uD7AF\u1100-\u11FF]/, langs: ['ko'] },
  cyrillic: { regex: /[\u0400-\u04FF]/, langs: ['ru'] },
  devanagari: { regex: /[\u0900-\u097F]/, langs: ['hi', 'mr'] },
  bengali: { regex: /[\u0980-\u09FF]/, langs: ['bn'] },
  tamil: { regex: /[\u0B80-\u0BFF]/, langs: ['ta'] },
  telugu: { regex: /[\u0C00-\u0C7F]/, langs: ['te'] },
  thai: { regex: /[\u0E00-\u0E7F]/, langs: ['th'] },
  greek: { regex: /[\u0370-\u03FF]/, langs: ['el'] },
  hebrew: { regex: /[\u0590-\u05FF]/, langs: ['he'] }
};

// Core functional words for supported languages to determine if text is in the user's language
const LANGUAGE_CORE_WORDS: Record<string, Set<string>> = {
  en: new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
    'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
    'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up',
    'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time',
    'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
    'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
    'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
    'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'are', 'is', 'was', 'were',
    'am', 'been', 'has', 'had', 'doing', 'did', 'does', 'today', 'tomorrow', 'yesterday', 'tonight',
    'morning', 'night', 'where', 'why', 'here', 'please', 'thanks', 'thank', 'sorry', 'welcome', 'great',
    'fine', 'much', 'many', 'very', 'too', 'again', 'before', 'should', 'must', 'might', 'still'
  ]),
  id: new Set([
    'yang', 'di', 'dan', 'itu', 'dengan', 'untuk', 'tidak', 'ini', 'dari', 'dalam', 'akan', 'pada',
    'juga', 'saya', 'ke', 'karena', 'tersebut', 'bisa', 'ada', 'mereka', 'lebih', 'sudah', 'kita',
    'kamu', 'dia', 'apa', 'sangat', 'terima', 'kasih', 'makasih', 'halo', 'selamat', 'pagi', 'siang',
    'malam', 'gimana', 'kok', 'sih', 'dong', 'ngapain', 'lagi', 'udah', 'gak', 'nggak', 'mau',
    'bener', 'banget', 'disini', 'dimana', 'kenapa', 'yuk', 'sekarang', 'besok', 'kapan', 'jangan',
    'hari', 'punya', 'tahu', 'sama', 'banyak', 'sedang', 'kalau', 'tapi', 'hanya', 'oleh', 'tentang'
  ]),
  es: new Set([
    'el', 'la', 'los', 'las', 'de', 'en', 'y', 'que', 'es', 'por', 'con', 'para', 'como', 'un',
    'una', 'pero', 'más', 'este', 'esta', 'esto', 'todo', 'mi', 'tu', 'su', 'qué', 'cómo', 'dónde',
    'cuándo', 'estás', 'hola', 'gracias', 'amigo', 'bien', 'también', 'buenos', 'días', 'tardes',
    'noches', 'tengo', 'quiero', 'estoy', 'nada', 'siempre', 'ahora', 'mañana', 'hoy', 'nosotros'
  ]),
  fr: new Set([
    'le', 'la', 'les', 'de', 'du', 'des', 'en', 'et', 'que', 'qui', 'dans', 'pour', 'avec', 'sur',
    'comme', 'mais', 'est', 'ce', 'cette', 'ces', 'un', 'une', 'nous', 'vous', 'ils', 'elles',
    'tout', 'très', 'merci', 'bonjour', 'comment', 'suis', 'pas', 'salut', 'bonsoir', 'beaucoup',
    'oui', 'non', 'faire', 'mon', 'ami', 'votre', 'notre', 'demain', 'aujourd', 'hui'
  ]),
  de: new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'einem', 'und', 'in',
    'zu', 'mit', 'sich', 'auf', 'für', 'ist', 'im', 'nicht', 'von', 'sie', 'bei', 'als', 'nach',
    'wie', 'aber', 'wir', 'danke', 'hallo', 'bitte', 'guten', 'morgen', 'tag', 'abend', 'geht',
    'ich', 'bist', 'sind', 'war', 'haben', 'sehr', 'gut', 'tschüss', 'wiedersehen', 'heute'
  ])
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

  // Rule 2: Empty or non-string inputs
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

  if (words.length === 0) return false;

  // Rule 5: Universal chat vocabulary check
  // If ALL words in the message are in the universal set (e.g. "hy", "hello", "ok thanks", "haha cool"),
  // it is universally understandable and never foreign
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

  // Rule 7: Language match check against user's language
  // We check if the message is in the user's understandable language.
  const userWordSet = LANGUAGE_CORE_WORDS[normalizedUserLang] || LANGUAGE_CORE_WORDS['en'];

  let userLangMatchCount = 0;
  for (const w of words) {
    if (userWordSet.has(w) || UNIVERSAL_WORDS.has(w)) {
      userLangMatchCount++;
    }
  }

  // Calculate ratio of words recognized in user's language
  const userLangRatio = userLangMatchCount / words.length;

  // If the majority of words are recognized in the user's language, it's NOT foreign!
  if (userLangRatio >= 0.5) {
    return false;
  }

  // Otherwise, it does NOT match the user's language -> IT IS A FOREIGN LANGUAGE!
  // Every foreign language in the world (Italian, Turkish, Polish, Dutch, Tagalog, Swedish, Swahili, etc.) is allowed
  return true;
}
