import { describe, it, expect } from 'vitest';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe('Similarity Calculations', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3];
      expect(cosineSimilarity(vec, vec)).toBe(1);
    });
    
    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      expect(cosineSimilarity(vecA, vecB)).toBe(0);
    });
    
    it('should return correct similarity for similar vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [2, 4, 6];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1, 5);
    });
  });
});
