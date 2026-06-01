import type { Bindings } from '../../types';

export interface TavilySearchOptions {
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
  published_date?: string;
}

export class TavilySearchClient {
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com';

  constructor(private env: Bindings) {
    this.apiKey = env.TAVILY_API_KEY;
  }

  async search(query: string, options?: TavilySearchOptions): Promise<TavilyResult[]> {
    if (!this.apiKey) return this.getMockResults(query);

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          query,
          search_depth: options?.searchDepth || 'basic',
          max_results: options?.maxResults || 5,
          include_domains: options?.includeDomains,
          exclude_domains: options?.excludeDomains,
          include_answer: false,
          include_raw_content: false,
        }),
      });

      if (!response.ok) throw new Error(`Tavily API error: ${response.status}`);
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Tavily search failed:', error);
      return this.getMockResults(query);
    }
  }

  async searchWithContext(query: string, context: string, options?: TavilySearchOptions): Promise<TavilyResult[]> {
    const enhancedQuery = `${query} ${context}`;
    return this.search(enhancedQuery, options);
  }

  async batchSearch(queries: string[], options?: TavilySearchOptions): Promise<TavilyResult[][]> {
    return await Promise.all(queries.map(query => this.search(query, options)));
  }

  async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({ query }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.suggestions || [];
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    }
    return [];
  }

  private getMockResults(query: string): TavilyResult[] {
    return [{
      title: `Search result for "${query.substring(0, 50)}"`,
      url: 'https://example.com',
      content: `Mock search result content for query: ${query.substring(0, 100)}`,
      score: 0.85,
    }];
  }
}
