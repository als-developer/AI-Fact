/**
 * Text processing utilities
 */

export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?;:-]/g, '')
    .trim();
}

export function truncateText(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function extractKeywords(text: string, limit: number = 10): string[] {
  const words = text.toLowerCase().split(/\W+/);
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'but', 'not', 'so', 'than', 'that', 'these', 'those', 'this', 'those']);
  const freq = new Map<string, number>();
  
  for (const word of words) {
    if (word.length > 3 && !stopWords.has(word)) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }
  
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

export function removeDuplicateSentences(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const unique = [];
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(sentence);
    }
  }
  return unique.join(' ');
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

export function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
}
