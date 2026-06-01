import { describe, it, expect } from 'vitest';
import { cleanText, truncateText, extractKeywords, countWords, countSentences } from '../../core/utils/text.utils';

describe('Text Utils', () => {
  describe('cleanText', () => {
    it('should remove extra whitespace', () => {
      expect(cleanText('hello    world')).toBe('hello world');
    });
    
    it('should trim the text', () => {
      expect(cleanText('  hello world  ')).toBe('hello world');
    });
    
    it('should handle empty strings', () => {
      expect(cleanText('')).toBe('');
    });
  });
  
  describe('truncateText', () => {
    it('should truncate text longer than max length', () => {
      const text = 'a'.repeat(100);
      expect(truncateText(text, 50)).toBe('a'.repeat(47) + '...');
    });
    
    it('should return original text if shorter than max length', () => {
      const text = 'short text';
      expect(truncateText(text, 50)).toBe(text);
    });
  });
  
  describe('extractKeywords', () => {
    it('should extract keywords from text', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const keywords = extractKeywords(text, 3);
      expect(keywords).toContain('quick');
      expect(keywords).toContain('brown');
      expect(keywords).toContain('jumps');
    });
  });
  
  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(countWords('hello world')).toBe(2);
      expect(countWords('one two three four')).toBe(4);
      expect(countWords('')).toBe(0);
    });
  });
  
  describe('countSentences', () => {
    it('should count sentences correctly', () => {
      expect(countSentences('Hello world. This is a test.')).toBe(2);
      expect(countSentences('One sentence')).toBe(1);
      expect(countSentences('')).toBe(0);
    });
  });
});
