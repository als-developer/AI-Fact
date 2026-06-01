/**
 * Academic Search Service
 * Searches scholarly articles and academic papers
 */

import type { Bindings, Source } from '../types';

export interface AcademicSearchOptions {
  maxResults?: number;
  yearFrom?: number;
  yearTo?: number;
  sortBy?: 'relevance' | 'date' | 'citations';
}

export class AcademicSearchService {
  constructor(private env: Bindings) {}

  async search(query: string, options?: AcademicSearchOptions): Promise<Source[]> {
    try {
      // Using Semantic Scholar API (free, no API key required for basic usage)
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${options?.maxResults || 5}&fields=title,url,abstract,year,citationCount,openAccessPdf`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Semantic Scholar error: ${response.status}`);
      
      const data = await response.json();
      return this.transformResults(data.data || []);
      
    } catch (error) {
      console.error('Academic search failed:', error);
      return this.getMockResults(query);
    }
  }

  private transformResults(results: any[]): Source[] {
    return results.map(result => ({
      url: result.url || result.openAccessPdf?.url || `https://www.semanticscholar.org/paper/${result.paperId}`,
      title: result.title,
      snippet: result.abstract || 'No abstract available',
      domain_authority: 0.95,
      published_date: result.year ? `${result.year}` : undefined,
      site_name: 'Semantic Scholar',
      favicon: 'https://www.semanticscholar.org/favicon.ico',
    }));
  }

  private getMockResults(query: string): Source[] {
    return [{
      url: 'https://scholar.google.com/',
      title: `Academic research on "${query.substring(0, 50)}"`,
      snippet: `This is a simulated academic result. In production, Semantic Scholar API would return real papers.`,
      domain_authority: 0.95,
      site_name: 'Google Scholar',
      favicon: 'https://scholar.google.com/favicon.ico',
    }];
  }
}
