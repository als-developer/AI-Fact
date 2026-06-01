import type { Bindings } from '../../types';

export class CohereEmbeddingClient {
  private apiKey: string;
  private baseUrl = 'https://api.cohere.ai/v1';

  constructor(private env: Bindings) {
    this.apiKey = env.COHERE_API_KEY;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) throw new Error('COHERE_API_KEY not configured');

    const response = await fetch(`${this.baseUrl}/embed`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: [text], model: 'embed-multilingual-v3.0', input_type: 'search_document' }),
    });

    if (!response.ok) throw new Error(`Cohere API error: ${response.status}`);
    const data = await response.json();
    return data.embeddings?.[0] || [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) throw new Error('COHERE_API_KEY not configured');

    const response = await fetch(`${this.baseUrl}/embed`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, model: 'embed-multilingual-v3.0', input_type: 'search_document' }),
    });

    if (!response.ok) throw new Error(`Cohere API error: ${response.status}`);
    const data = await response.json();
    return data.embeddings || [];
  }

  async rerank(query: string, documents: string[]): Promise<Array<{ index: number; relevance_score: number }>> {
    if (!this.apiKey) throw new Error('COHERE_API_KEY not configured');

    const response = await fetch(`${this.baseUrl}/rerank`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, documents, model: 'rerank-multilingual-v2.0', top_n: 10 }),
    });

    if (!response.ok) throw new Error(`Cohere rerank error: ${response.status}`);
    const data = await response.json();
    return data.results || [];
  }
}
