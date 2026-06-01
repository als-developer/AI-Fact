import type { Bindings } from '../../types';

export class OpenAIClient {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(private env: Bindings) {
    this.apiKey = env.OPENAI_API_KEY;
  }

  async chatCompletion(messages: Array<{ role: string; content: string }>, model: string = 'gpt-3.5-turbo'): Promise<string> {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY not configured');

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 500 }),
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async moderate(text: string): Promise<{ flagged: boolean; categories: Record<string, boolean> }> {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY not configured');

    const response = await fetch(`${this.baseUrl}/moderations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text }),
    });

    if (!response.ok) throw new Error(`OpenAI moderation error: ${response.status}`);
    const data = await response.json();
    const result = data.results?.[0];
    return { flagged: result?.flagged || false, categories: result?.categories || {} };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY not configured');

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    });

    if (!response.ok) throw new Error(`OpenAI embedding error: ${response.status}`);
    const data = await response.json();
    return data.data?.[0]?.embedding || [];
  }
}
