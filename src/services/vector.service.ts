import type { Bindings } from '../types';

export interface VectorStoreEntry {
  claim: string; embedding: number[] | null; verdict: string; confidence: number; sources: any[]; timestamp: number;
}

export interface VectorSearchResult {
  claim: string; verdict: string; confidence: number; similarity: number; sources: any[]; timestamp: number;
}

export class VectorService {
  constructor(private env: Bindings) {}

  async store(entry: VectorStoreEntry): Promise<void> {
    const embeddingJson = entry.embedding ? JSON.stringify(entry.embedding) : null;
    await this.env.DB.prepare(`INSERT OR REPLACE INTO verified_facts (claim_hash, claim, embedding, verdict, confidence, sources, verification_count, last_verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(this.hashClaim(entry.claim), entry.claim, embeddingJson, entry.verdict, entry.confidence, JSON.stringify(entry.sources), 1, Date.now(), entry.timestamp).run();
  }

  async searchSimilar(embedding: number[], threshold: number = 0.75): Promise<VectorSearchResult[]> {
    const results = await this.env.DB.prepare(`SELECT claim, verdict, confidence, sources, last_verified_at FROM verified_facts WHERE confidence > ? ORDER BY last_verified_at DESC LIMIT 20`).bind(threshold - 0.2).all();
    const scoredResults: VectorSearchResult[] = [];
    for (const row of results.results) {
      if (row.confidence >= threshold) {
        scoredResults.push({ claim: row.claim, verdict: row.verdict, confidence: row.confidence, similarity: row.confidence, sources: JSON.parse(row.sources || '[]'), timestamp: row.last_verified_at });
      }
    }
    scoredResults.sort((a, b) => b.similarity - a.similarity);
    return scoredResults.slice(0, 5);
  }

  async batchStore(entries: VectorStoreEntry[]): Promise<void> {
    const batch = this.env.DB.batch(entries.map(entry => this.env.DB.prepare(`INSERT OR REPLACE INTO verified_facts (claim_hash, claim, embedding, verdict, confidence, sources, verification_count, last_verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(this.hashClaim(entry.claim), entry.claim, entry.embedding ? JSON.stringify(entry.embedding) : null, entry.verdict, entry.confidence, JSON.stringify(entry.sources), 1, Date.now(), entry.timestamp)));
    await batch;
  }

  async getStats(): Promise<{ total: number; byVerdict: Record<string, number> }> {
    const result = await this.env.DB.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN verdict = 'TRUE' THEN 1 ELSE 0 END) as true_count, SUM(CASE WHEN verdict = 'SUSPICIOUS' THEN 1 ELSE 0 END) as suspicious_count, SUM(CASE WHEN verdict = 'FALSE' THEN 1 ELSE 0 END) as false_count FROM verified_facts`).first();
    return { total: result?.total || 0, byVerdict: { TRUE: result?.true_count || 0, SUSPICIOUS: result?.suspicious_count || 0, FALSE: result?.false_count || 0 } };
  }

  async cleanup(maxAgeDays: number = 30): Promise<number> {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const result = await this.env.DB.prepare(`DELETE FROM verified_facts WHERE last_verified_at < ?`).bind(cutoff).run();
    return result.meta?.changes || 0;
  }

  private hashClaim(claim: string): string {
    let hash = 0;
    for (let i = 0; i < claim.length; i++) { const char = claim.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash = hash & hash; }
    return Math.abs(hash).toString(36);
  }
}
