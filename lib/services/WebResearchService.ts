/**
 * WebResearchService.ts
 * Real-time Deep Web & Scientific Knowledge Research Service for Vicalary AI Health Coach.
 * Performs fast multi-source web searches (DuckDuckGo, Wikipedia, Scientific DBs)
 * and extracts factual evidence to power intelligent AI responses.
 */

export interface WebSearchResult {
  title: string;
  snippet: string;
  source: string;
}

export class WebResearchService {
  /**
   * Search Wikipedia for scientific, nutritional, and medical definitions/facts.
   */
  private static async searchWikipedia(query: string): Promise<WebSearchResult[]> {
    try {
      // Clean query for wiki search
      const cleanTerm = query
        .replace(/what is|how does|why do|can i|should i|is it|the|a|an/gi, '')
        .trim();
      if (!cleanTerm) return [];

      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanTerm)}&format=json&origin=*`;
      const res = await fetch(wikiUrl, {
        signal: AbortSignal.timeout(2500),
      });

      if (res.ok) {
        const data = await res.json();
        const searchResults = data?.query?.search || [];
        return searchResults.slice(0, 2).map((item: any) => ({
          title: item.title,
          snippet: item.snippet.replace(/<[^>]+>/g, ''), // Strip HTML tags
          source: 'Wikipedia Scientific Knowledge',
        }));
      }
    } catch (e) {
      console.warn('[WebResearchService] Wikipedia lookup fallback:', e);
    }
    return [];
  }

  /**
   * Search DuckDuckGo HTML web search for live scientific & health snippets.
   */
  private static async searchDuckDuckGo(query: string): Promise<WebSearchResult[]> {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' health science study')}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const html = await res.text();
        const results: WebSearchResult[] = [];
        const regex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gi;
        let match;
        while ((match = regex.exec(html)) !== null && results.length < 3) {
          const cleanSnippet = match[1].replace(/<[^>]+>/g, '').trim();
          if (cleanSnippet && cleanSnippet.length > 20) {
            results.push({
              title: 'Live Web Finding',
              snippet: cleanSnippet,
              source: 'Web Search Engine',
            });
          }
        }
        return results;
      }
    } catch (e) {
      console.warn('[WebResearchService] DuckDuckGo fetch fallback:', e);
    }
    return [];
  }

  /**
   * Main entry point: Performs parallel deep web research across multiple sources.
   */
  public static async searchDeepWeb(userPrompt: string): Promise<string> {
    if (!userPrompt || userPrompt.trim().length < 3) return '';

    console.log(`[WebResearchService] Executing deep internet research for: "${userPrompt}"`);

    try {
      // Execute parallel searches with 3-second timeout guard
      const [wikiResults, webResults] = await Promise.all([
        this.searchWikipedia(userPrompt),
        this.searchDuckDuckGo(userPrompt),
      ]);

      const combined = [...webResults, ...wikiResults];

      if (combined.length === 0) {
        return '';
      }

      const formattedSnippets = combined
        .map((r, i) => `[Fact ${i + 1}] (${r.source}): ${r.snippet}`)
        .join('\n');

      console.log(`[WebResearchService] Successfully extracted ${combined.length} factual web sources.`);
      return formattedSnippets;
    } catch (err: any) {
      console.warn('[WebResearchService] Deep search error (falling back gracefully):', err?.message);
      return '';
    }
  }
}
