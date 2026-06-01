import type { Bindings } from '../../types';

export interface EmbeddingOptions {
  model?: string;
  timeout?: number;
}

export class EmbeddingService {
  private defaultModel = 'sentence-transformers/LaBSE';
  private fallbackModels = ['BAAI/bge-small-en-v1.5', 'intfloat/e5-small-v2', 'sentence-transformers/all-MiniLM-L6-v2'];
  
  constructor(private env: Bindings) {}

  async encode(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const model = options?.model || this.defaultModel;
    const apiKey = this.env.HUGGINGFACE_API_KEY;
    
    if (!apiKey) throw new Error('HUGGINGFACE_API_KEY not configured');
    
    const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: text }),
        signal: AbortSignal.timeout(options?.timeout || 10000),
      });
      
      if (!response.ok) throw new Error(`HuggingFace API error: ${response.status}`);
      const embedding = await response.json();
      if (Array.isArray(embedding)) return embedding;
      throw new Error('Invalid embedding response format');
      
    } catch (error) {
      console.error('HuggingFace embedding failed:', error);
      
      for (const fallbackModel of this.fallbackModels) {
        try {
          const response = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${fallbackModel}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: text }),
            signal: AbortSignal.timeout(10000),
          });
          
          if (response.ok) {
            const embedding = await response.json();
            if (Array.isArray(embedding)) return this.normalizeEmbedding(embedding);
          }
        } catch (fallbackError) {
          console.error(`Fallback model ${fallbackModel} failed:`, fallbackError);
        }
      }
      throw error;
    }
  }

  async encodeBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    const results: number[][] = [];
    const batchSize = 5;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(text => this.encode(text, options)));
      results.push(...batchResults);
    }
    return results;
  }

  private normalizeEmbedding(embedding: number[]): number[] {
    const targetDim = 768;
    if (embedding.length === targetDim) return embedding;
    if (embedding.length < targetDim) {
      const padded = [...embedding];
      while (padded.length < targetDim) padded.push(0);
      return padded;
    }
    return embedding.slice(0, targetDim);
  }

  cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    normA = Math.sqrt(normA); normB = Math.sqrt(normB);
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }
}
