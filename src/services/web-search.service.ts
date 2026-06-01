import type { Bindings, Source } from '../types';

export class WebSearchService {
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com';

  constructor(private env: Bindings) { this.apiKey = env.TAVILY_API_KEY; }

  async search(query: string, deepSearch: boolean = false): Promise<Source[]> {
    if (!this.apiKey) return this.getMockResults(query);
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({ query, search_depth: deepSearch ? 'advanced' : 'basic', max_results: 5, include_answer: false })
      });
      if (!response.ok) throw new Error(`Tavily API error: ${response.status}`);
      const data = await response.json();
      return this.transformResults(data.results || []);
    } catch (error) { return this.getMockResults(query); }
  }

  async batchSearch(queries: string[], deepSearch: boolean = false): Promise<Source[][]> {
    return await Promise.all(queries.map(query => this.search(query, deepSearch)));
  }

  private transformResults(results: any[]): Source[] {
    return results.map(result => ({
      url: result.url, title: result.title, snippet: result.content,
      domain_authority: this.calculateDomainAuthority(result.url),
      published_date: result.published_date, site_name: this.extractSiteName(result.url),
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(result.url).hostname}`
    }));
  }

  private calculateDomainAuthority(url: string): number {
    const hostname = new URL(url).hostname;
    if (['wikipedia.org', 'britannica.com', 'gov', 'edu', 'nature.com', 'science.org'].some(d => hostname.includes(d))) return 0.95;
    if (['nytimes.com', 'bbc.com', 'reuters.com', 'ap.org', 'wsj.com'].some(d => hostname.includes(d))) return 0.85;
    if (hostname.endsWith('.gov') || hostname.endsWith('.edu')) return 0.9;
    return 0.6;
  }

  private extractSiteName(url: string): string {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (parts.length >= 2) return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
    return hostname;
  }

  private getMockResults(query: string): Source[] {
    return [{ url: 'https://example.com', title: `Information about "${query.substring(0, 50)}"`, snippet: `Mock result for: ${query.substring(0, 100)}`, domain_authority: 0.7, site_name: 'Example', favicon: 'https://www.google.com/s2/favicons?domain=example.com' }];
  }
}
