export interface ToolExecutionResult {
  toolName: 'web_search' | 'location_places' | 'nutrition_facts';
  success: boolean;
  data: string;
  source?: string;
}

export interface ToolRoutingContext {
  userMessage: string;
  locationContext?: {
    city?: string;
    country?: string;
    region?: string;
    lat?: number;
    lng?: number;
  } | null;
}

/**
 * Tavily AI Search Tool (LLM-optimized search engine)
 */
async function executeTavilySearch(query: string, apiKey: string): Promise<ToolExecutionResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s max

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.slice(0, 200),
        search_depth: 'basic',
        include_answer: true,
        max_results: 3,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Tavily API responded with ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let facts = '';

    if (data.answer) {
      facts = `Direct Answer: ${data.answer}`;
    }

    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      const snippets = data.results
        .slice(0, 3)
        .map((r: any) => `[${r.title || 'Source'}]: ${r.content || ''}`)
        .join('\n');
      facts = facts ? `${facts}\n\nTop Results:\n${snippets}` : snippets;
    }

    if (!facts) {
      return {
        toolName: 'web_search',
        success: false,
        data: '',
        source: 'tavily',
      };
    }

    return {
      toolName: 'web_search',
      success: true,
      data: facts.slice(0, 1000),
      source: 'tavily',
    };
  } catch (err: any) {
    console.warn('[ToolRouter] Tavily search error, falling back:', err?.message);
    throw err;
  }
}

/**
 * Fallback Web Search Tool using DuckDuckGo Instant Answers
 */
async function executeDuckDuckGoSearch(query: string): Promise<ToolExecutionResult> {
  try {
    const cleanQuery = encodeURIComponent(query.slice(0, 150));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`https://api.duckduckgo.com/?q=${cleanQuery}&format=json&no_html=1&skip_disambig=1`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VicalaryAI/1.0' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`DuckDuckGo request failed with status ${res.status}`);

    const data = await res.json();
    let snippet = '';

    if (data.AbstractText) {
      snippet = data.AbstractText;
    } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topicTexts = data.RelatedTopics
        .slice(0, 3)
        .map((t: any) => t.Text)
        .filter(Boolean);
      snippet = topicTexts.join('; ');
    }

    if (!snippet) {
      return {
        toolName: 'web_search',
        success: false,
        data: '',
        source: 'duckduckgo',
      };
    }

    return {
      toolName: 'web_search',
      success: true,
      data: snippet.slice(0, 600),
      source: 'duckduckgo',
    };
  } catch (error: any) {
    console.warn('[ToolRouter] DuckDuckGo fallback search failed:', error?.message);
    return {
      toolName: 'web_search',
      success: false,
      data: '',
      source: 'fallback',
    };
  }
}

/**
 * Unified Web Search Tool (Prioritizes Tavily AI, falls back to DuckDuckGo)
 */
export async function executeWebSearch(query: string): Promise<ToolExecutionResult> {
  const tavilyKey = process.env.TAVILY_API_KEY || process.env.NEXT_PUBLIC_TAVILY_API_KEY;

  if (tavilyKey && !tavilyKey.includes('placeholder')) {
    try {
      return await executeTavilySearch(query, tavilyKey);
    } catch {
      // Gracefully fall back to DuckDuckGo if Tavily encounters network issue
      return await executeDuckDuckGoSearch(query);
    }
  }

  return await executeDuckDuckGoSearch(query);
}

/**
 * Location & Nearby Places Context Tool
 */
export async function executeLocationPlaces(
  locationContext: ToolRoutingContext['locationContext'],
  query: string
): Promise<ToolExecutionResult> {
  const city = locationContext?.city;
  const country = locationContext?.country;

  if (!city && !country) {
    return {
      toolName: 'location_places',
      success: false,
      data: ''
    };
  }

  const locStr = city ? `${city}${country ? `, ${country}` : ''}` : country;

  return {
    toolName: 'location_places',
    success: true,
    data: `User location context: ${locStr}. Query: "${query}". Provide practical, geographically accurate recommendations for ${locStr}.`
  };
}

/**
 * Fast Tool Classifier and Parallel Router
 */
export async function routeAndExecuteTools(context: ToolRoutingContext): Promise<ToolExecutionResult[]> {
  const { userMessage, locationContext } = context;
  const lowerMsg = userMessage.toLowerCase();
  const results: ToolExecutionResult[] = [];

  // Detect current events, research, live facts, or world news intent
  const isCurrentEventOrNews = /(news|today|yesterday|recently|recent|happening|happened|current|latest|gaza|israel|ukraine|indonesia|event|stock price|election|breaking|president|minister|research|study|studies|weather|who is|who won|update|trends|what is going on|situation in)/i.test(lowerMsg);
  
  // Detect location / nearby places intent
  const isLocationPlacesQuery = /(nearest|near me|nearby|where can i find|supermarket|grocery store|gym|pharmacy|halal food|restaurant near|where am i|my current location|my location|what city|what country|where do i live|where am i located)/i.test(lowerMsg);

  const promises: Promise<ToolExecutionResult>[] = [];

  if (isCurrentEventOrNews) {
    promises.push(executeWebSearch(userMessage));
  }

  if (isLocationPlacesQuery) {
    promises.push(executeLocationPlaces(locationContext, userMessage));
  }

  if (promises.length > 0) {
    const toolOutputs = await Promise.allSettled(promises);
    toolOutputs.forEach(out => {
      if (out.status === 'fulfilled') {
        results.push(out.value);
      }
    });
  }

  return results;
}
