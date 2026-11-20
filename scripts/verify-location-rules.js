// Verify location inquiry patterns and zero-hallucination logic
const INTENT_PATTERNS = [
  /\b(where am i|what is my (?:current )?location|my location|current location|where am i located|what city am i in|what country am i in)\b/i,
  /\b(niko wapi|nipo wapi|eneo langu|wapi nilipo)\b/i, // Swahili
  /\b(d[oó]nde estoy|d[oó]nde me encuentro|mi ubicaci[oó]n)\b/i, // Spanish
  /\b(o[uù] suis-je|o[uù] je suis|ma position|ma localisation)\b/i, // French
  /\b(di\s*mana saya|saya di\s*mana|lokasi saya)\b/i, // Indonesian
  /\b(nearest|nearby|supermarket|grocery store|restaurant|where to buy|halal store|market near me)\b/i
];

function isLocationInquiry(msg) {
  return INTENT_PATTERNS.some(p => p.test(msg));
}

function resolveLocationName(locationContext) {
  const resolvedCountry = locationContext?.country || locationContext?.country_name || '';
  const resolvedCity = locationContext?.city || locationContext?.region || '';
  return locationContext?.formatted_location || (
    resolvedCity && resolvedCountry
      ? `${resolvedCity}, ${resolvedCountry}`
      : (resolvedCity || resolvedCountry || '')
  );
}

function runTests() {
  console.log('--- TEST 1: Location Inquiries Multi-Lingual Regex ---');
  const queries = [
    { text: 'Where am I?', expected: true },
    { text: 'What is my current location?', expected: true },
    { text: 'Where am I located right now?', expected: true },
    { text: 'Niko wapi?', expected: true },
    { text: 'Nipo wapi leo?', expected: true },
    { text: 'Di mana saya?', expected: true },
    { text: 'Saya di mana?', expected: true },
    { text: 'Où suis-je ?', expected: true },
    { text: '¿Dónde estoy?', expected: true },
    { text: 'Hello coach!', expected: false },
    { text: 'How many calories in an apple?', expected: false }
  ];

  for (const q of queries) {
    const matched = isLocationInquiry(q.text);
    console.log(`Query: "${q.text}" -> Matched: ${matched}`);
    if (matched !== q.expected) {
      throw new Error(`Failed for "${q.text}". Expected ${q.expected}, got ${matched}`);
    }
  }
  console.log('✅ TEST 1 PASSED: Multi-lingual intent patterns match perfectly!\n');

  console.log('--- TEST 2: Zero-Hallucination Location Name Resolution ---');
  const cases = [
    {
      ctx: { city: 'Osaka', country: 'Japan', formatted_location: 'Osaka, Japan' },
      expected: 'Osaka, Japan',
      forbidden: 'Indonesia'
    },
    {
      ctx: { city: 'Purwakarta', country: 'Indonesia', formatted_location: 'Purwakarta, Indonesia' },
      expected: 'Purwakarta, Indonesia',
      forbidden: ''
    },
    {
      ctx: { city: 'Nairobi', country_name: 'Kenya', formatted_location: 'Nairobi, Kenya' },
      expected: 'Nairobi, Kenya',
      forbidden: 'Indonesia'
    },
    {
      // Stale or legacy format where country property was missing
      ctx: { city: 'Nairobi', country_name: 'Kenya' },
      expected: 'Nairobi, Kenya',
      forbidden: 'Indonesia'
    },
    {
      // Empty context - must NOT return 'Indonesia'
      ctx: null,
      expected: '',
      forbidden: 'Indonesia'
    }
  ];

  for (const c of cases) {
    const result = resolveLocationName(c.ctx);
    console.log(`Input: ${JSON.stringify(c.ctx)} -> Output: "${result}"`);
    if (result !== c.expected) {
      throw new Error(`Resolution mismatch. Expected "${c.expected}", got "${result}"`);
    }
    if (c.forbidden && result.includes(c.forbidden)) {
      throw new Error(`Forbidden word "${c.forbidden}" found in "${result}"!`);
    }
  }
  console.log('✅ TEST 2 PASSED: Zero-hallucination verified. No erroneous default countries!\n');

  console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
}

runTests();
