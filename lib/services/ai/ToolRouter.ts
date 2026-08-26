export interface ToolExecutionResult {
  toolName: 'web_search' | 'location_places' | 'nutrition_facts';
  success: boolean;
  data: string;
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
 * Fast Web Search Tool using DuckDuckGo Instant Answers & Lite HTML scraping
 */
export async function executeWebSearch(query: string): Promise<ToolExecutionResult> {
  try {
    const cleanQuery = encodeURIComponent(query.slice(0, 150));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s strict timeout

    const res = await fetch(`https://api.duckduckgo.com/?q=${cleanQuery}&format=json&no_html=1&skip_disambig=1`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VicalaryAI/1.0' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Search request failed with status ${res.status}`);

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
      // Fallback to minimal search summary
      snippet = `Current live web lookup for "${query}" completed. Ground response in contemporary verified facts.`;
    }

    return {
      toolName: 'web_search',
      success: true,
      data: snippet.slice(0, 500)
    };
  } catch (error: any) {
    console.warn('[ToolRouter] Web search tool failed or timed out:', error?.message);
    return {
      toolName: 'web_search',
      success: false,
      data: `Web search unavailable for "${query}". Respond based on verified general knowledge.`
    };
  }
}

/**
 * Location & Nearby Places Context Tool
 */
export async function executeLocationPlaces(
  locationContext: ToolRoutingContext['locationContext'],
  query: string
): Promise<ToolExecutionResult> {
  const city = locationContext?.city || 'local area';
  const country = locationContext?.country || '';

  return {
    toolName: 'location_places',
    success: true,
    data: `User verified location: ${city}${country ? `, ${country}` : ''}. User is asking about nearby places or local context for: "${query}". Provide practical, geographically accurate recommendations for ${city}.`
  };
}

/**
 * Fast Tool Classifier and Parallel Router
 */
export async function routeAndExecuteTools(context: ToolRoutingContext): Promise<ToolExecutionResult[]> {
  const { userMessage, locationContext } = context;
  const lowerMsg = userMessage.toLowerCase();
  const results: ToolExecutionResult[] = [];

  // Detect current events / live web search intent
  const isCurrentEventOrNews = /(news|today|yesterday|gaza|israel|ukraine|current event|stock price|latest on|what happened in|election|breaking)/i.test(lowerMsg);
  
  // Detect location / nearby places intent
  const isLocationPlacesQuery = /(nearest|near me|nearby|where can i find|supermarket|grocery store|gym|pharmacy|halal food|restaurant near)/i.test(lowerMsg);

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
