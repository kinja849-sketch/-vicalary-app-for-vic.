# Chat Message Translation Feature — Implementation Specification (Strict 1-on-1 Human Chats Only)

## 1. Executive Summary & Core Constraints
- **Exclusivity Gate (Strict Non-Coach Constraint)**:
  - This feature **ONLY** applies to **1-on-1 human-to-human conversations**.
  - **Health Coach is 100% excluded**: Under no circumstances will translation buttons, prompts, or logic appear in the AI Health Coach conversation (`isAI === true` or `msg.sender_id === COACH_ID` or `type === 'coach'`).
- **Precision Foreign Language Gate**:
  - "See translation" **ONLY** appears when an incoming message is genuinely in a foreign language.
  - It is **HIDDEN** for messages that are understandable by the user:
    - User's own outgoing messages (`isMe === true`) never show "See translation".
    - Messages in the user's active language (e.g. English for English users, Indonesian for Indonesian users) never show "See translation".
    - Universal chat greetings and abbreviations (e.g. "hy", "hello", "ok", "thanks", "cool", emojis, numbers, links) never show "See translation".
    - Verified via deterministic language detection in `lib/utils/languageDetector.ts`.
- **Zero-Distortion & High-Accuracy Mandate**:
  - Translations must be direct, faithful, and strictly preserve conversational tone, slang, conciseness, line breaks, punctuation, numbers, and emojis.
  - Zero hallucination: The translation engine will never summarize, elaborate, add pleasantries, or "correct" typos in the original message.
  - Deterministic generation: Runs at `temperature: 0.0`.
- **Target Language Strategy**:
  - Automatically identifies the viewing user's preferred language (`useTranslation().lang` via user settings / location / language detector).
  - Tapping "See translation" translates into this exact target language.
- **Client-Side Cache & Reversibility**:
  - Instant toggle between "See translation" and "See original" with zero network latency once fetched.

---

## 2. Technical Architecture & Safeguards

```
+-----------------------------------------------------------------------------------------+
|  Chat Message Bubble (ChatConversation.tsx)                                             |
|                                                                                         |
|  HARD GATES:                                                                            |
|  - Is this the AI Health Coach? (`isAI || msg.sender_id === COACH_ID`) -> EXIT (No UI)  |
|  - Is message deleted or empty? -> EXIT                                                 |
|  - Is message type NOT text? -> EXIT                                                    |
|                                                                                         |
|  IF 1-on-1 Human Text Message:                                                          |
|  - Render subtle "See translation" button below message text                            |
+-------------------------------------------+---------------------------------------------+
                                            |
                                            | User taps "See translation"
                                            v
+-----------------------------------------------------------------------------------------+
|  Local Memory Cache Check (Component State)                                             |
|  - If `translationsCache[msg.id]` exists:                                               |
|      Toggle display directly (0ms latency, zero API calls)                              |
|  - Else:                                                                                |
|      Set `translatingMsgId = msg.id`                                                    |
|      Call `POST /api/chat/translate` with { text, targetLang, messageId }              |
+-------------------------------------------+---------------------------------------------+
                                            |
                                            v
+-----------------------------------------------------------------------------------------+
|  Serverless Route (`app/api/chat/translate/route.ts`)                                   |
|  1. Verify Supabase session (User must be authenticated)                                |
|  2. Fast Bypass: If text is only numbers/emojis/punctuation, return verbatim            |
|  3. Strict Zero-Distortion System Prompt (temperature: 0.0, response_format: json_object) |
|  4. Execute via `lib/ai/ai-fallback.ts` (OpenAI GPT-4o-mini <-> Google Gemini fallback)  |
|  5. Return { translatedText, detectedSourceLang, isSameLanguage }                       |
+-------------------------------------------+---------------------------------------------+
                                            |
                                            v
+-----------------------------------------------------------------------------------------+
|  Faithful UI Rendering                                                                  |
|  - Replaces text with accurate translation                                              |
|  - Displays subtle metadata: "Translated from [Language] · See original"                |
|  - Bubble geometry, timestamps, check ticks, and emoji reaction row remain untouched    |
+-----------------------------------------------------------------------------------------+
```

---

## 3. How Zero-Distortion & Maximum Accuracy Is Achieved

### The Distortion Problem & Our Solution
| Risk | Potential Distortion | Deterministic Solution |
| :--- | :--- | :--- |
| **Model Chattyness** | "Here is the English translation of your text: ..." | System prompt strictly enforces pure JSON with zero conversational preamble. |
| **Elaboration / Fixing** | Turning "hy" into "Hello, how can I assist you today?" | Strict rule: "Preserve exact conciseness and tone. A short greeting must translate to a short greeting." |
| **Random Synonyms** | Using uncommon poetic words instead of natural chat words | `temperature: 0.0` ensures the single most probable, natural direct translation. |
| **Name & Entity Mangling** | Translating names like "Victoria" into "Victory" | Explicit rule: "Never translate proper names, usernames, brands, numbers, or URLs." |
| **Emoji / Formatting Loss** | Stripping emojis, exclamation marks, or line breaks | Emojis, punctuation, and whitespace structures are explicitly preserved verbatim. |
| **Same Language Noise** | Translating English to English and rewording it | Automatic language detection: If source matches target language, returns original unchanged. |

### Translation Prompt Blueprint
```text
You are a precise, high-fidelity real-time chat translator.
Your sole job is to translate the user's text into the target language: {{targetLang}}.

STRICT RULES:
1. Maintain the exact meaning, conversational tone (casual, formal, slang, abbreviations), and conciseness.
2. DO NOT explain, summarize, elaborate, or add introductory words.
3. DO NOT fix spelling errors or grammar from the original sender — mirror the exact conversational register.
4. DO NOT translate personal names, brand names, usernames, numbers, or URLs.
5. PRESERVE ALL emojis, symbols, punctuation marks, and line breaks exactly where they are.
6. If the input text is already in the target language (or cannot be translated), return the exact original text.
7. Return ONLY valid JSON:
   {
     "translatedText": "<translated text>",
     "detectedSourceLang": "<Full English name of source language, e.g. Spanish, Indonesian, French>"
   }
```

---

## 4. UI/UX Surface Specification (Matching Existing WhatsApp Protected Style)

1. **Strict Non-Coach Condition**:
   ```tsx
   if (isAI || msg.sender_id === COACH_ID) {
       // NEVER render translation buttons or options
       return null;
   }
   ```
2. **Untranslated State (Incoming or Outgoing 1-on-1 Chat)**:
   - Below the message text, before the timestamp row:
   - Subtle clickable action:
     ```tsx
     <button
       type="button"
       onClick={() => handleTranslate(msg)}
       className="text-[11px] text-[#027EB5] dark:text-[#53bdeb] hover:underline font-medium mt-0.5 select-none text-left"
     >
       See translation
     </button>
     ```
3. **Translating State**:
   - Shows subtle pulsing text: `Translating...` with a tiny spinner.
4. **Translated State**:
   - The message displays the translated text.
   - Beneath the translated text:
     ```tsx
     <div className="flex items-center gap-1.5 text-[10px] text-[#667781] dark:text-white/60 mt-0.5 select-none">
       <span>Translated from {detectedSourceLang}</span>
       <span>·</span>
       <button
         type="button"
         onClick={() => toggleOriginal(msg.id)}
         className="text-[#027EB5] dark:text-[#53bdeb] hover:underline font-medium"
       >
         See original
       </button>
     </div>
     ```
   - Clicking `See original` switches back instantly to the original text without any network call.

---

## 5. File Changes Plan

1. **`app/api/chat/translate/route.ts`** *(New)*
   - Serverless route.
   - Authenticated Supabase session.
   - Temperature 0.0 with dual OpenAI / Gemini fallback via `lib/ai/ai-fallback.ts`.
   - Zod validation and fast-path bypass for trivial/emoji-only content.
2. **`lib/api/chat.ts`** *(Modify)*
   - Add `translateChatMessage(text: string, targetLang: string): Promise<{ translatedText: string; detectedSourceLang: string }>`
3. **`app/_pages/ChatConversation.tsx`** *(Modify)*
   - Keep 100% isolated to 1-on-1 conversations (`!isAI && msg.sender_id !== COACH_ID`).
   - Add local cache state `translations: Record<string, { translatedText: string; detectedSourceLang: string; showOriginal: boolean; isLoading: boolean }>`.
   - Render translation toggle inside message bubble.
   - Add translation button in hover action bar next to Smile and Trash icons.
4. **`lib/translations/en.ts`** *(Modify)*
   - Add keys: `see_translation: "See translation"`, `see_original: "See original"`, `translating: "Translating..."`, `translated_from: "Translated from %s"`.

---

## 6. Verification Plan
1. **Health Coach Isolation Test**:
   - Open Health Coach chat (`/chat?id=ai-coach` or coach conversation).
   - Verify that **NO** translation button, link, or indicator appears on any Health Coach message or user message to the Coach.
2. **1-on-1 Direct Chat Test**:
   - Open conversation with "Victoria" (or another user).
   - Send/receive messages in various foreign languages (e.g. French, Spanish, German, Indonesian, Arabic, Japanese).
   - Tap "See translation" -> verify accurate, distortion-free translation in user's target language.
   - Tap "See original" -> instant revert to original text.
   - Verify emojis, punctuation, capitalization, and formatting remain 100% intact.
3. **Visual Regressions**:
   - Confirm reaction bar, delete modal, delivery checkmarks, and timestamps are unaffected.
