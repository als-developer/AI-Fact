import type { Bindings, VerificationRequest, VerificationResult, ClaimResult, Source, VerificationSummary } from '../types';
import { VectorService } from './vector.service';
import { WebSearchService } from './web-search.service';
import { AcademicSearchService } from './academic-search.service';
import { CacheService } from './cache.service';
import { SentenceSplitterService } from './sentence-splitter.service';
import { EmbeddingService } from '../integrations/huggingface/embeddings';
import { ulid } from 'ulid';

export class FactCheckService {
  private vectorService: VectorService;
  private webSearch: WebSearchService;
  private academicSearch: AcademicSearchService;
  private cacheService: CacheService;
  private sentenceSplitter: SentenceSplitterService;
  private embeddingService: EmbeddingService;
  
  constructor(private env: Bindings) {
    this.vectorService = new VectorService(env);
    this.webSearch = new WebSearchService(env);
    this.academicSearch = new AcademicSearchService(env);
    this.cacheService = new CacheService(env);
    this.sentenceSplitter = new SentenceSplitterService();
    this.embeddingService = new EmbeddingService(env);
  }
  
  async verifySync(request: VerificationRequest): Promise<VerificationResult> {
    const startTime = performance.now();
    const jobId = ulid();
    
    try {
      const claims = await this.sentenceSplitter.splitIntoClaims(request.text, request.language || 'en');
      
      if (claims.length === 0) {
        return {
          job_id: jobId, status: 'completed', overall_score: 100, verdict: 'TRUE', claims: [],
          summary: { total_claims: 0, verified_count: 0, suspicious_count: 0, false_count: 0, risk_level: 'LOW', confidence_distribution: { high: 0, medium: 0, low: 0 }, top_domains: [] },
          processing_time_ms: performance.now() - startTime
        };
      }
      
      const cacheKeys = claims.map(c => this.getCacheKey(c));
      const cachedResults = await this.cacheService.getMany(cacheKeys);
      const uncachedClaims = claims.filter((_, i) => !cachedResults[i]);
      const uncachedIndices = claims.reduce((acc, _, i) => { if (!cachedResults[i]) acc.push(i); return acc; }, [] as number[]);
      
      let newResults: ClaimResult[] = [];
      if (uncachedClaims.length > 0) {
        const verificationTasks = uncachedClaims.map(claim => this.verifySingleClaim(claim, request.engine_mode || 'standard', request.threshold || 0.75));
        newResults = await Promise.all(verificationTasks);
      }
      
      const allResults: ClaimResult[] = new Array(claims.length);
      let cacheIdx = 0, newIdx = 0;
      for (let i = 0; i < claims.length; i++) {
        if (cachedResults[i]) allResults[i] = cachedResults[i];
        else allResults[i] = newResults[newIdx++];
      }
      
      const newCacheEntries = uncachedIndices.map((idx, i) => ({ key: cacheKeys[idx], value: newResults[i], ttl: 86400 }));
      await this.cacheService.setMany(newCacheEntries);
      await this.storeVerificationResults(allResults);
      
      const summary = this.calculateSummary(allResults);
      const overallScore = this.calculateOverallScore(allResults);
      const verdict = this.determineVerdict(overallScore);
      await this.storeJobResult(jobId, request, allResults, summary, overallScore, verdict);
      await this.trackUsage(request.org_id || 'unknown', claims.length);
      
      return {
        job_id: jobId, status: 'completed', overall_score: overallScore, verdict,
        claims: allResults, summary, processing_time_ms: performance.now() - startTime,
        credits_used: claims.length, remaining_credits: await this.getRemainingCredits(request.org_id)
      };
    } catch (error) {
      console.error('Fact check sync failed:', error);
      return {
        job_id: jobId, status: 'failed', overall_score: 0, verdict: 'SUSPICIOUS', claims: [],
        summary: { total_claims: 0, verified_count: 0, suspicious_count: 0, false_count: 0, risk_level: 'HIGH', confidence_distribution: { high: 0, medium: 0, low: 0 }, top_domains: [] },
        processing_time_ms: performance.now() - startTime
      };
    }
  }
  
  private async verifySingleClaim(claim: string, mode: string, threshold: number): Promise<ClaimResult> {
    const claimEmbedding = await this.embeddingService.encode(claim);
    const vectorMatches = await this.vectorService.searchSimilar(claimEmbedding, threshold);
    
    if (vectorMatches.length > 0 && vectorMatches[0].similarity > 0.85) {
      return {
        claim, verdict: vectorMatches[0].verdict as any, confidence: vectorMatches[0].similarity,
        color: vectorMatches[0].similarity >= 0.82 ? 'green' : vectorMatches[0].similarity >= 0.6 ? 'yellow' : 'red',
        sources: vectorMatches[0].sources || [], semantic_similarity: vectorMatches[0].similarity,
        claim_type: this.detectClaimType(claim)
      };
    }
    
    let sources: Source[] = [];
    if (mode === 'academic') sources = await this.academicSearch.search(claim);
    else sources = await this.webSearch.search(claim, mode === 'deep');
    
    if (sources.length === 0) {
      return { claim, verdict: 'SUSPICIOUS', confidence: 0.3, color: 'yellow', sources: [], semantic_similarity: 0, claim_type: this.detectClaimType(claim) };
    }
    
    const sourceEmbedding = await this.embeddingService.encode(sources[0].snippet);
    const similarity = this.calculateCosineSimilarity(claimEmbedding, sourceEmbedding);
    
    let verdict: 'TRUE' | 'SUSPICIOUS' | 'FALSE';
    let color: 'green' | 'yellow' | 'red';
    if (similarity >= 0.82) { verdict = 'TRUE'; color = 'green'; }
    else if (similarity >= 0.60) { verdict = 'SUSPICIOUS'; color = 'yellow'; }
    else { verdict = 'FALSE'; color = 'red'; }
    
    await this.vectorService.store({ claim, embedding: claimEmbedding, verdict, confidence: similarity, sources: sources.slice(0, 3), timestamp: Date.now() });
    
    return { claim, verdict, confidence: similarity, color, sources: sources.slice(0, 3), semantic_similarity: similarity, claim_type: this.detectClaimType(claim) };
  }
  
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    normA = Math.sqrt(normA); normB = Math.sqrt(normB);
    return normA && normB ? dotProduct / (normA * normB) : 0;
  }
  
  private calculateSummary(results: ClaimResult[]): VerificationSummary {
    const total = results.length;
    const verified = results.filter(r => r.verdict === 'TRUE').length;
    const suspicious = results.filter(r => r.verdict === 'SUSPICIOUS').length;
    const falseClaims = results.filter(r => r.verdict === 'FALSE').length;
    const highConfidence = results.filter(r => r.confidence >= 0.8).length;
    const mediumConfidence = results.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length;
    const lowConfidence = results.filter(r => r.confidence < 0.6).length;
    
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    const falsePercentage = falseClaims / total;
    if (falsePercentage >= 0.5) riskLevel = 'CRITICAL';
    else if (falsePercentage >= 0.3) riskLevel = 'HIGH';
    else if (falsePercentage >= 0.1) riskLevel = 'MEDIUM';
    
    return { total_claims: total, verified_count: verified, suspicious_count: suspicious, false_count: falseClaims, risk_level: riskLevel, confidence_distribution: { high: highConfidence, medium: mediumConfidence, low: lowConfidence }, top_domains: [] };
  }
  
  private calculateOverallScore(results: ClaimResult[]): number {
    if (results.length === 0) return 100;
    return (results.reduce((sum, r) => sum + r.confidence, 0) / results.length) * 100;
  }
  
  private determineVerdict(score: number): 'TRUE' | 'PARTIAL' | 'SUSPICIOUS' | 'FALSE' {
    if (score >= 85) return 'TRUE';
    if (score >= 60) return 'PARTIAL';
    if (score >= 30) return 'SUSPICIOUS';
    return 'FALSE';
  }
  
  private detectClaimType(claim: string): 'factual' | 'opinion' | 'prediction' | 'definition' {
    const lowerClaim = claim.toLowerCase();
    const opinionWords = ['think', 'believe', 'feel', 'suggest', 'probably', 'maybe'];
    const predictionWords = ['will', 'would', 'shall', 'forecast', 'predict', 'expected'];
    const definitionWords = ['is defined as', 'refers to', 'means that', 'can be described as'];
    if (definitionWords.some(w => lowerClaim.includes(w))) return 'definition';
    if (predictionWords.some(w => lowerClaim.includes(w))) return 'prediction';
    if (opinionWords.some(w => lowerClaim.includes(w))) return 'opinion';
    return 'factual';
  }
  
  private getCacheKey(claim: string): string {
    return `fact:${Buffer.from(claim.toLowerCase().trim().replace(/\s+/g, ' ')).toString('base64').slice(0, 100)}`;
  }
  
  private async storeVerificationResults(results: ClaimResult[]): Promise<void> {
    await Promise.allSettled(results.map(result => this.vectorService.store({ claim: result.claim, embedding: null, verdict: result.verdict, confidence: result.confidence, sources: result.sources, timestamp: Date.now() })));
  }
  
  private async storeJobResult(jobId: string, request: VerificationRequest, results: ClaimResult[], summary: VerificationSummary, overallScore: number, verdict: string): Promise<void> {
    await this.env.DB.prepare(`INSERT INTO verification_jobs (id, user_id, org_id, text_preview, total_claims, overall_score, verdict, summary, results, processing_time_ms, engine_mode, credits_used, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(jobId, request.user_id || null, request.org_id || null, request.text.slice(0, 500), results.length, overallScore, verdict, JSON.stringify(summary), JSON.stringify(results), Date.now(), request.engine_mode || 'standard', results.length, 'completed', Date.now(), Date.now()).run();
  }
  
  private async trackUsage(orgId: string, claimsUsed: number): Promise<void> {
    await this.env.DB.prepare(`UPDATE organizations SET verifications_used = verifications_used + ? WHERE id = ?`).bind(claimsUsed, orgId).run();
    const today = new Date().toISOString().slice(0, 10);
    await this.env.DB.prepare(`INSERT INTO usage_stats (id, date, org_id, total_verifications, total_claims, created_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(date, org_id) DO UPDATE SET total_verifications = total_verifications + 1, total_claims = total_claims + ?`).bind(ulid(), today, orgId, claimsUsed, Date.now(), claimsUsed).run();
  }
  
  private async getRemainingCredits(orgId?: string): Promise<number | undefined> {
    if (!orgId) return undefined;
    const result = await this.env.DB.prepare(`SELECT max_monthly_verifications, verifications_used FROM organizations WHERE id = ?`).bind(orgId).first<{ max_monthly_verifications: number; verifications_used: number }>();
    return result ? Math.max(0, result.max_monthly_verifications - result.verifications_used) : undefined;
  }
  
  async queueVerification(jobId: string, request: VerificationRequest): Promise<void> {
    await this.env.JOB_QUEUE.send({ type: 'verification', job_id: jobId, request, timestamp: Date.now() });
    await this.env.DB.prepare(`INSERT INTO verification_jobs (id, user_id, org_id, text_preview, status, created_at) VALUES (?, ?, ?, ?, 'queued', ?)`).bind(jobId, request.user_id || null, request.org_id || null, request.text.slice(0, 500), Date.now()).run();
  }
  
  async getJobStatus(jobId: string): Promise<any> {
    return await this.env.DB.prepare(`SELECT * FROM verification_jobs WHERE id = ?`).bind(jobId).first();
  }
}
